"""
30 destination SEO ランディング (/to/[slug]) 用 200〜300 字描述文の批量生成。

外部 LLM CLI を subprocess で呼び出し、5 駅 × 6 batch で incremental save。
1 batch あたり ~1500 字出力なので timeout 180 秒で安全。

CLI binary 名と引数は使用する LLM provider に応じて差し替え可能。
現在は claude CLI を想定。

- 入力: 本ファイル内 DESTINATIONS（lib/destinations.ts と同期、編集時は両方）
- 出力: ./public/data/destination_descriptions.json (batch ごとに上書き保存)
- 用途: app/to/[slug]/page.tsx の本文として埋め込み

使い方:
    python scripts/generate_destination_descriptions.py             # 全 30 駅生成 (既存をマージ)
    python scripts/generate_destination_descriptions.py --force     # 既存を無視して全駅再生成
    python scripts/generate_destination_descriptions.py --slugs shibuya,shinjuku  # 指定 slug のみ再生成
    python scripts/generate_destination_descriptions.py --dry-run   # 標準出力のみ
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JSON = REPO_ROOT / "public" / "data" / "destination_descriptions.json"

CLAUDE_MODEL = "sonnet"
OPENAI_MODEL = "gpt-5.4-nano"
OPENAI_MAX_COMPLETION_TOKENS = 8000
LLM_TIMEOUT = 240
BATCH_SIZE = 5
MAX_RETRIES = 2
RETRY_DELAY = 5

# (slug, display_name) — lib/destinations.ts の DESTINATIONS_META と同期
DESTINATIONS: list[tuple[str, str]] = [
    ("shinjuku",       "新宿"),
    ("shibuya",        "渋谷"),
    ("tokyo",          "東京駅"),
    ("ikebukuro",      "池袋"),
    ("shinagawa",      "品川"),
    ("otemachi",       "大手町"),
    ("roppongi",       "六本木"),
    ("toranomon",      "虎ノ門"),
    ("shimbashi",      "新橋"),
    ("akihabara",      "秋葉原"),
    ("yurakucho",      "有楽町"),
    ("hamamatsucho",   "浜松町"),
    ("tamachi",        "田町"),
    ("osaki",          "大崎"),
    ("gotanda",        "五反田"),
    ("meguro",         "目黒"),
    ("takadanobaba",   "高田馬場"),
    ("iidabashi",      "飯田橋"),
    ("kanda",          "神田"),
    ("ochanomizu",     "御茶ノ水"),
    ("akasakamitsuke", "赤坂見附"),
    ("omotesando",     "表参道"),
    ("yokohama",       "横浜"),
    ("minatomirai",    "みなとみらい"),
    ("musashikosugi",  "武蔵小杉"),
    ("omiya",          "大宮"),
    ("chiba",          "千葉"),
    ("tachikawa",      "立川"),
    ("oshiage",        "押上"),
    ("toyosu",         "豊洲"),
]


SYSTEM_PROMPT = """\
あなたは関東圏の街・通勤事情に詳しい日本語ライターです。
Kayoha（東京圏 1843 駅の通勤時間カラーリング地図 + AI 駅推薦サービス）の
各通勤先（駅）専用 SEO ランディングページに掲載する説明文を、駅ごとに
200〜300 字で執筆してください。

【ページの目的】
渋谷・新宿・東京 等の主要駅を通勤先とする読者が、自分に合う「住む街」を
探すための地図ページの導入文。

【書く内容（自然に組み込む）】
- 通勤先としての性格（産業集積・規模・代表的勤め先のタイプ）
- そこへ通う人のタイプ（職種・年齢層など、ステレオタイプ化しない範囲で）
- 通勤圏の地理的特徴（方面・主要路線・所要時間レンジ）
- 家賃相場の傾向（都心通勤の住宅費の方向性、固有金額は出さなくてよい）
- Kayoha の本ページで何ができるか（5 分刻みのカラー地図、AI 駅推薦、
  家賃目安、コミュニティ評価。1〜2 文に圧縮）

【スタイル】
- editorial / 事実調 / 敬体（です・ます調）
- 1 段落の流れる文章。改行・箇条書き禁止
- 1 駅あたり厳密に 200〜300 字（句読点込み）
- 同じ文型を 30 駅で繰り返さない（書き出しと締めくくりに多様性を持たせる）
- 句末は必ず「。」

【絶対禁止】
- 宣伝口調（「おすすめ」「絶対」「人気抜群」「ベスト」など）
- ethnicity / 国籍 / 文化圏 を特定する表現（「華人向け」「欧米人向け」など）
- 改行・感嘆符・絵文字
- 物件販売の煽り文句（「いますぐ問い合わせ」など）
- 実在しない施設・固有名詞の捏造

【ハルシネーション防止】
- 確信のある事実のみ書く。不明な点は一般論で。
- 固有施設名（特定の店舗・公園名）は最小限。沿線名と方面は具体的でよい。

【出力形式】
JSON のみ。前置きや markdown code fence は一切不要。
{
  "stations": {
    "<slug1>": "<200〜300字>",
    "<slug2>": "<200〜300字>"
  }
}

key は渡された slug と完全一致させること。
"""


def build_user_prompt(batch: list[tuple[str, str]]) -> str:
    lines = [
        f"以下の {len(batch)} 駅について、それぞれ通勤先 SEO ランディングページ用の "
        "200〜300 字の導入文を JSON 形式で執筆してください。",
        "",
        "【駅リスト】 (slug — 表示名)",
    ]
    for slug, name in batch:
        lines.append(f"- {slug} — {name}")
    lines.append("")
    lines.append(
        f"{len(batch)} 駅すべての説明文を 1 つの JSON オブジェクトで返してください。"
        "key は slug、value は 200〜300 字の説明文。"
        "出力は JSON オブジェクトのみ、markdown code fence や前置きは禁止。"
    )
    return "\n".join(lines)


def load_env_local() -> None:
    """`.env.local` を環境変数に流し込む（既存値は上書きしない）。"""
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def call_claude(user_prompt: str, *, timeout: int = LLM_TIMEOUT) -> dict[str, str]:
    cmd = [
        "claude", "-p",
        "--model", CLAUDE_MODEL,
        "--output-format", "json",
        "--tools", "",
        "--no-session-persistence",
        "--system-prompt", SYSTEM_PROMPT,
        user_prompt,
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"LLM CLI exited {result.returncode}: {result.stderr[:500]}"
        )
    envelope = json.loads(result.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"LLM api_error: {envelope.get('result', '')[:500]}")
    raw = (envelope.get("result") or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)
    payload = json.loads(raw)
    if "stations" not in payload or not isinstance(payload["stations"], dict):
        raise ValueError(f"missing 'stations' dict: {raw[:300]}")
    return payload["stations"]


def call_openai(user_prompt: str, *, timeout: int = LLM_TIMEOUT) -> dict[str, str]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing (load .env.local first)")

    body = json.dumps({
        "model": OPENAI_MODEL,
        "max_completion_tokens": OPENAI_MAX_COMPLETION_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        method="POST",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            envelope = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"OpenAI HTTP {e.code}: {err_body}")

    choices = envelope.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenAI empty choices: {str(envelope)[:300]}")
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        raise RuntimeError(f"OpenAI empty content: {str(envelope)[:300]}")
    payload = json.loads(content)
    if "stations" not in payload or not isinstance(payload["stations"], dict):
        raise ValueError(f"missing 'stations' dict: {content[:300]}")
    return payload["stations"]


# provider dispatch — main() で argparse 後に上書きされる
_PROVIDER = "openai"


def call_llm(user_prompt: str, *, timeout: int = LLM_TIMEOUT) -> dict[str, str]:
    if _PROVIDER == "claude":
        return call_claude(user_prompt, timeout=timeout)
    return call_openai(user_prompt, timeout=timeout)


FORBIDDEN_CHARS = set("！?\n\r\t")


def validate_value(value) -> str | None:
    if not isinstance(value, str):
        return "non-string value"
    v = value.strip()
    if not v:
        return "empty"
    if any(c in v for c in FORBIDDEN_CHARS):
        return "forbidden chars (改行/感嘆符)"
    if not v.endswith("。"):
        return f"missing 句点: '...{v[-3:]}'"
    if len(v) < 180:
        return f"too short ({len(v)} chars)"
    if len(v) > 340:
        return f"too long ({len(v)} chars)"
    return None


def load_existing() -> dict:
    if OUTPUT_JSON.exists():
        return json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    return {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "generator": "external LLM (incremental batches)",
            "model": OPENAI_MODEL if _PROVIDER == "openai" else CLAUDE_MODEL,
            "station_count": 0,
            "disclaimer": "AI 生成的 SEO 用説明文。事実関係は要確認、編集前提",
        },
        "stations": {},
    }


def save_output(data: dict) -> None:
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run_batch(batch: list[tuple[str, str]]) -> dict[str, str] | None:
    """1 batch 呼出 + retry。最終失敗時は None を返す。"""
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return call_llm(build_user_prompt(batch))
        except Exception as e:
            last_err = e
            msg = str(e).replace("\n", " ")[:150]
            print(f"  [retry {attempt}/{MAX_RETRIES}] {type(e).__name__}: {msg}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
    print(f"  [error] batch failed after {MAX_RETRIES} attempts: {last_err}",
          file=sys.stderr)
    return None


def main() -> None:
    global _PROVIDER
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=["openai", "claude"], default="openai",
                    help="LLM provider (default: openai)")
    ap.add_argument("--dry-run", action="store_true",
                    help="標準出力に出すだけ JSON ファイルに書かない")
    ap.add_argument("--force", action="store_true",
                    help="既存 JSON を無視して全 destination 再生成")
    ap.add_argument("--slugs", type=str, default=None,
                    help="カンマ区切り slug を指定すると、その slug のみ再生成 (既存は他をそのまま残す)")
    args = ap.parse_args()

    _PROVIDER = args.provider
    if _PROVIDER == "openai":
        load_env_local()
        if not os.environ.get("OPENAI_API_KEY"):
            print("[error] OPENAI_API_KEY が見つかりません (.env.local 確認)", file=sys.stderr)
            sys.exit(2)

    existing = load_existing()

    if args.slugs:
        wanted = {s.strip() for s in args.slugs.split(",") if s.strip()}
        targets = [(s, n) for s, n in DESTINATIONS if s in wanted]
        if not targets:
            print(f"[error] no matching slugs in {sorted(wanted)}", file=sys.stderr)
            sys.exit(2)
    elif args.force:
        targets = list(DESTINATIONS)
    else:
        done = set(existing["stations"].keys())
        targets = [(s, n) for s, n in DESTINATIONS if s not in done]

    if not targets:
        print(f"[info] nothing to generate ({len(existing['stations'])} already done)")
        return

    model_label = OPENAI_MODEL if _PROVIDER == "openai" else CLAUDE_MODEL
    print(f"[info] generating {len(targets)} destination(s) | provider: {_PROVIDER} | model: {model_label}")
    print(f"[info] batch size: {BATCH_SIZE} | timeout per batch: {LLM_TIMEOUT}s")

    batches = [targets[i:i + BATCH_SIZE]
               for i in range(0, len(targets), BATCH_SIZE)]

    total_invalid: list[tuple[str, str, str]] = []
    t_start = time.time()

    for idx, batch in enumerate(batches, start=1):
        slugs = [s for s, _ in batch]
        print(f"[batch {idx}/{len(batches)}] {slugs}")
        t0 = time.time()
        result = run_batch(batch)
        elapsed = time.time() - t0

        if result is None:
            print(f"[batch {idx}] FAILED, skipping ({elapsed:.0f}s)", file=sys.stderr)
            continue

        requested_slugs = {s for s, _ in batch}
        received = set(result.keys())
        missing = requested_slugs - received
        extra = received - requested_slugs
        for k in list(extra):
            del result[k]

        for slug, val in result.items():
            err = validate_value(val)
            if err:
                total_invalid.append((slug, err, val))

        if args.dry_run:
            print(f"  [dry-run] +{len(result)} ({elapsed:.0f}s)")
            for slug, text in result.items():
                print(f"    {slug}: {text[:80]}...")
        else:
            existing["stations"].update(result)
            existing["_meta"]["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            existing["_meta"]["station_count"] = len(existing["stations"])
            save_output(existing)
            print(f"  +{len(result)} → {len(existing['stations'])}/{len(DESTINATIONS)} "
                  f"({elapsed:.0f}s)")

        if missing:
            print(f"  [warn] missing in batch: {sorted(missing)}")
        if extra:
            print(f"  [warn] extra (dropped): {sorted(extra)}")

    total_elapsed = time.time() - t_start
    print(f"\n[done] elapsed: {total_elapsed:.0f}s ({total_elapsed/60:.1f} min)")
    if total_invalid:
        print(f"[warn] {len(total_invalid)} validation issues:")
        for slug, err, val in total_invalid[:10]:
            print(f"  ✗ {slug}: {err} → {val[:60]}")
    if not args.dry_run:
        print(f"[done] wrote {OUTPUT_JSON.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
