"""
1843 駅「周辺の特徴」批量生成スクリプト

Claude Code CLI（`claude -p`）を subprocess で呼び出し、主人の Max 配額で稼働。
- 入力: ../_handoff/stations_for_features.md（1843 駅）
- 風格基準: ../_handoff/batch1_完成サンプル.json（先頭 101 駅、Few-shot に使用）
- 出力: ./public/data/area_features.json（増分保存）

使い方:
    python scripts/generate_area_features.py --dry-run             # 80 駅サンプル
    python scripts/generate_area_features.py                       # 全量
    python scripts/generate_area_features.py --max-batches 3       # 最初の 3 batch のみ
"""
from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = REPO_ROOT.parent
HANDOFF_DIR = PROJECT_ROOT / "_handoff"

INPUT_MD = HANDOFF_DIR / "stations_for_features.md"
BATCH1_JSON = HANDOFF_DIR / "batch1_完成サンプル.json"
OUTPUT_JSON = REPO_ROOT / "public" / "data" / "area_features.json"
FAIL_LOG = REPO_ROOT / "scripts" / "_area_features_failures.json"
DRY_RUN_OUT = HANDOFF_DIR / "dry_run_sample.json"

MODEL = "sonnet"
BATCH_SIZE = 40
MAX_RETRIES = 3
RETRY_BASE_DELAY = 5
CLAUDE_TIMEOUT = 1200
DEFAULT_CONCURRENCY = 3

SYSTEM_PROMPT = """\
あなたは関東圏の街・駅に詳しい日本語ライターです。
これから複数の駅のリストを渡しますので、各駅の「周辺の特徴」を日本語で 1〜2 文、40〜80 字程度で書いてください。

【出力形式】
JSON のみ。前置きや説明文、markdown code fence は一切不要。
{
  "stations": {
    "<駅名1>": "<特徴文1>",
    "<駅名2>": "<特徴文2>"
  }
}

【ルール】
- key は渡された駅名と完全一致させること（漢字・カナ・括弧・全角半角まで含めて完全一致）
- value は 1〜2 文の日本語、40〜80 字、句末は必ず「。」
- 区切りは「、」「・」「。」のみ。改行・感嘆符・絵文字・通常引用符は禁止
- editorial / 簡潔事実調。宣伝口調は NG（「素晴らしい！」「人気抜群！」など）
- 形容詞は 1〜2 個まで
- 全駅 ethnicity / 文化圏 neutral（特定の国籍や民族を読者として想定しない）

【含めるべき内容（あれば）】
- 街の性格（住宅・商業・学生街・下町・高級住宅・地方郊外 等）
- 沿線・交通の便（路線数・直通先・新宿への所要時間）
- 主要施設（公園・大学・商店街・ランドマーク）
- 家賃感（高め / 中 / 安め）
- 治安・住環境
- 主なターゲット層（単身 / カップル / ファミリー / 学生）

【ハルシネーション防止】
1. 知っている駅 → 自信を持って書く
2. 弱いが沿線・都道府県から推論可能 → 一般論で書き、固有名詞（店名・特定の公園名）は避ける
   例：「栃木県南部の住宅地、烏山線沿線。新宿まで2時間弱、東京通勤圏外。地方都市生活向き。」
3. 全く知らない / 確信が無い → value は "データ不足" の 4 文字のみ
4. 通勤時間「到達不可」の駅は「東京通勤圏外」「観光・生活拠点」等のトーンで書く

【絶対禁止】
- 実在しない店・施設・公園の捏造
- 宣伝口調
- 改行・感嘆符・絵文字
- ethnicity 特定（「華人向け」「欧米人向け」等）
"""

FEW_SHOT_EXAMPLES = [
    ("新宿", "JR山手・中央線含む十数路線交差、東京最大級の繁華街。買物・娯楽すべて揃うが家賃高、一部エリアは治安要注意。"),
    ("渋谷", "JR山手線含む多数路線交差、若者文化・IT企業集積の繁華街。家賃高、夜は賑やか、エリアにより治安差あり。"),
    ("恵比寿", "山手線高級住宅エリア、外国人比率高め。レストラン充実、ガーデンプレイス徒歩圏、家賃は都内屈指。"),
    ("代官山", "東急東横線、ハイセンスな住宅・商業エリア。低層住宅とブティック、家賃都内屈指、外国人居住者多。"),
    ("高田馬場", "山手線・西武新宿線・東西線3線、早稲田大学最寄りの学生街。飲食店・古書店多数、家賃中、活気あり。"),
    ("駒場東大前", "京王井の頭線、東京大学駒場キャンパス最寄り。学生街と住宅街が混在、家賃中〜やや高め。"),
    ("吉祥寺", "中央線住宅人気No.1。井の頭公園・サンロード商店街・カフェ文化が魅力、単身〜ファミリーまで対応。"),
    ("荻窪", "JR中央線・丸ノ内線、住宅人気の高い杉並区エリア。商店街・公園多数、ファミリー層人気、家賃中。"),
    ("十条(東京)", "JR埼京線、十条銀座商店街が活気ある住宅地。家賃中〜やや安め、ファミリー〜単身向け、下町感あり。"),
    ("高円寺", "JR中央線、サブカル・古着・ライブハウス文化の街。若者・単身者人気、家賃中、阿波踊りで有名。"),
    ("下北沢", "京王井の頭線・小田急線、若者文化のメッカ。古着屋・ライブハウス・小劇場密集、家賃中〜やや高、サブカル好き向け。"),
    ("目白", "JR山手線、学習院大学が立地する閑静な高級住宅地。治安良好、家賃高め、ファミリー層多い、落ち着いた環境。"),
    ("大崎", "JR山手・埼京・湘南新宿線、再開発でオフィス・タワマン集積。家賃やや高、単身〜DINKS向け、清潔感高い。"),
    ("新大久保", "山手線、コリアンタウンとして有名な多国籍エリア。アジア系外国人比率高、飲食店密集、家賃中、賑やか。"),
    ("国会議事堂前", "東京メトロ丸ノ内・千代田線、永田町・霞ヶ関の政治中枢。住宅はほぼ無く、官公庁・議員エリア。"),
]


STATION_RE = re.compile(r"^- \*\*(.+?)\*\* — (.+?) — 新宿 (.+)$")
SECTION_RE = re.compile(r"^## (.+?)（(\d+) 駅）$")


def parse_stations(md_path: Path) -> list[dict]:
    stations = []
    current_pref = None
    for line in md_path.read_text(encoding="utf-8").splitlines():
        m = SECTION_RE.match(line)
        if m:
            current_pref = m.group(1)
            continue
        m = STATION_RE.match(line)
        if m:
            stations.append({
                "name": m.group(1),
                "lines": m.group(2),
                "commute": m.group(3).strip(),
                "pref": current_pref or "?",
            })
    return stations


def load_existing_output() -> dict:
    if OUTPUT_JSON.exists():
        return json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    batch1 = json.loads(BATCH1_JSON.read_text(encoding="utf-8"))
    return {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "model": f"claude-{MODEL} (via Claude Code CLI)",
            "station_count_target": 0,
            "completed_batches": [1],
            "disclaimer": "AI 生成的参考情报、最新实况建议现地确认",
            "batch1_source": "小雪 (Claude.ai web) 手工生成",
        },
        "stations": dict(batch1["stations"]),
    }


def save_output(data: dict) -> None:
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def build_user_prompt(batch: list[dict]) -> str:
    example_json = {"stations": dict(FEW_SHOT_EXAMPLES)}
    example_block = json.dumps(example_json, ensure_ascii=False, indent=2)
    lines = [
        "以下は Batch 1（東京都中心 101 駅）で先行生成された参考スタイル例です。同じ簡潔事実調・40〜80 字・JSON 形式で出力してください。",
        "",
        "【参考スタイル例】",
        example_block,
        "",
        f"【今回生成する駅リスト（{len(batch)} 駅）】",
        "各行: 駅名 — 沿線 — 都道府県 — 新宿駅まで所要時間",
        "",
    ]
    for s in batch:
        lines.append(f"- {s['name']} — {s['lines']} — {s['pref']} — 新宿 {s['commute']}")
    lines.append("")
    lines.append("上記の全駅について JSON で出力してください。key は完全一致、value は 40〜80 字の特徴文（自信が無ければ「データ不足」）。出力は JSON オブジェクトのみ。")
    return "\n".join(lines)


def call_claude(user_prompt: str, *, timeout: int = CLAUDE_TIMEOUT) -> dict:
    cmd = [
        "claude", "-p",
        "--model", MODEL,
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
        raise RuntimeError(f"claude CLI exited {result.returncode}: {result.stderr[:500]}")
    envelope = json.loads(result.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude api_error: {envelope.get('result', '')[:500]}")
    raw = (envelope.get("result") or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)
    payload = json.loads(raw)
    if "stations" not in payload or not isinstance(payload["stations"], dict):
        raise ValueError(f"missing 'stations' dict: {raw[:300]}")
    return payload["stations"]


FORBIDDEN_CHARS = set("！?\n\r\t")


def validate_value(value) -> str | None:
    if not isinstance(value, str):
        return "non-string value"
    v = value.strip()
    if not v:
        return "empty"
    if v == "データ不足":
        return None
    if any(c in v for c in FORBIDDEN_CHARS):
        return "forbidden chars (改行/感嘆符)"
    if not v.endswith("。"):
        return f"missing 句点: '...{v[-3:]}'"
    if len(v) < 25:
        return f"too short ({len(v)} chars)"
    if len(v) > 120:
        return f"too long ({len(v)} chars)"
    return None


def stratified_sample(all_stations: list[dict], batch1_names: set[str], seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    by_pref: dict[str, list[dict]] = {}
    for s in all_stations:
        if s["name"] in batch1_names:
            continue
        by_pref.setdefault(s["pref"], []).append(s)
    quotas = {
        "東京都": 6,
        "神奈川県": 6,
        "埼玉県": 5,
        "千葉県": 6,
        "茨城県": 6,
        "栃木県": 4,
        "群馬県": 4,
        "山梨県": 3,
    }
    sample = []
    for pref, stations in by_pref.items():
        q = min(quotas.get(pref, 5), len(stations))
        sample.extend(rng.sample(stations, q))
    return sample


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="40 駅サンプル 1 batch、主出力には書かない")
    ap.add_argument("--max-batches", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    ap.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="並列 batch 数")
    ap.add_argument("--sleep", type=float, default=2.0, help="(legacy, 並列モードでは無視)")
    args = ap.parse_args()

    all_stations = parse_stations(INPUT_MD)
    print(f"[info] parsed {len(all_stations)} stations from {INPUT_MD.name}")

    batch1_names = set(json.loads(BATCH1_JSON.read_text(encoding="utf-8"))["stations"].keys())

    if args.dry_run:
        sample = stratified_sample(all_stations, batch1_names)
        pref_counts = {}
        for s in sample:
            pref_counts[s["pref"]] = pref_counts.get(s["pref"], 0) + 1
        print(f"[dry-run] sampling {len(sample)} stations | distribution: {pref_counts}")

        t0 = time.time()
        try:
            result = call_claude(build_user_prompt(sample))
        except Exception as e:
            print(f"[dry-run] FAILED: {e}", file=sys.stderr)
            sys.exit(2)
        elapsed = time.time() - t0

        DRY_RUN_OUT.write_text(
            json.dumps({"stations": result}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        errors = []
        no_data = []
        for name, val in result.items():
            err = validate_value(val)
            if err:
                errors.append((name, err, val))
            elif val == "データ不足":
                no_data.append(name)

        requested = {s["name"] for s in sample}
        missing = requested - set(result.keys())

        print(f"[dry-run] elapsed: {elapsed:.1f}s")
        print(f"[dry-run] received {len(result)} / requested {len(sample)} stations")
        print(f"[dry-run] missing keys: {len(missing)} {list(missing)[:5]}")
        print(f"[dry-run] 「データ不足」: {len(no_data)} 駅")
        print(f"[dry-run] validation errors: {len(errors)}")
        for name, err, val in errors[:10]:
            print(f"  ✗ {name}: {err} → {val[:60]}")
        print(f"[dry-run] sample written to {DRY_RUN_OUT.relative_to(PROJECT_ROOT)}")
        return

    existing = load_existing_output()
    existing["_meta"]["station_count_target"] = len(all_stations)
    save_output(existing)

    done_names = set(existing["stations"].keys())
    remaining = [s for s in all_stations if s["name"] not in done_names]
    print(f"[info] already done: {len(done_names)} / remaining: {len(remaining)}")

    if not remaining:
        print("[info] nothing to do.")
        return

    pref_order = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県", "山梨県"]
    remaining.sort(key=lambda s: (
        pref_order.index(s["pref"]) if s["pref"] in pref_order else 99,
        s["commute"],
    ))

    batches = [remaining[i:i + args.batch_size] for i in range(0, len(remaining), args.batch_size)]
    if args.max_batches:
        batches = batches[:args.max_batches]
    print(f"[info] split into {len(batches)} batches of up to {args.batch_size}")
    print(f"[info] concurrency: {args.concurrency}")

    failures: list[dict] = []
    state_lock = threading.Lock()
    t_start = time.time()

    def process_batch(idx: int, batch: list[dict]) -> tuple[int, dict | None, Exception | None]:
        last_err = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                result = call_claude(build_user_prompt(batch))
                return idx, result, None
            except Exception as e:
                last_err = e
                delay = RETRY_BASE_DELAY * attempt
                msg = str(e).replace("\n", " ")[:150]
                with state_lock:
                    print(f"  [batch {idx} retry {attempt}/{MAX_RETRIES}] {type(e).__name__}: {msg} (sleep {delay}s)")
                time.sleep(delay)
        return idx, None, last_err

    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = {ex.submit(process_batch, i, b): (i, b) for i, b in enumerate(batches, start=1)}
        completed = 0
        for fut in as_completed(futures):
            idx, batch = futures[fut]
            completed += 1
            try:
                _, result, err = fut.result()
            except Exception as e:
                result, err = None, e

            if result is None:
                with state_lock:
                    print(f"  ✗ batch {idx} FAILED after {MAX_RETRIES} retries: {err}")
                    failures.append({
                        "batch": idx,
                        "station_count": len(batch),
                        "stations": [s["name"] for s in batch],
                        "error": str(err),
                    })
                    FAIL_LOG.write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
                continue

            invalid = [(name, validate_value(val)) for name, val in result.items() if validate_value(val)]
            requested = {s["name"] for s in batch}
            received = set(result.keys())
            missing = requested - received
            extra = received - requested
            for k in extra:
                del result[k]

            with state_lock:
                existing["stations"].update(result)
                existing["_meta"]["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                save_output(existing)
                suffix = []
                if invalid:
                    suffix.append(f"invalid={len(invalid)}")
                if missing:
                    suffix.append(f"missing={len(missing)}")
                if extra:
                    suffix.append(f"dropped_extra={len(extra)}")
                suffix_str = f" ({', '.join(suffix)})" if suffix else ""
                elapsed_min = (time.time() - t_start) / 60
                print(f"[{completed}/{len(batches)}] batch {idx}: +{len(result)} → {len(existing['stations'])}/{len(all_stations)} | {elapsed_min:.1f}min{suffix_str}")
                for n, e in invalid[:3]:
                    print(f"    ⚠ {n}: {e}")

    elapsed = time.time() - t_start
    print(f"\n[done] elapsed: {elapsed / 60:.1f} min ({elapsed:.0f}s)")
    print(f"[done] final coverage: {len(existing['stations'])}/{len(all_stations)}")
    if failures:
        print(f"[done] {len(failures)} batches failed; see {FAIL_LOG.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
