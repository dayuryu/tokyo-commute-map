#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1831 駅名のローマ字（英語表記）批量生成スクリプト

generate_area_features.py と同じく Claude CLI を subprocess で呼び出す。
駅名標準式ヘボン（長音符なし・JR 東日本方式: ん→m before b/m/p、
接頭駅は Shin-Yokohama 式ハイフン）で出力する。

- 入力: ./public/data/stations.geojson（name の一意集合、1831 駅）
- 出力: ./public/data/station_names_en.json  { "日本語駅名": "Romaji", ... }
        （バッチごと増分保存 → 中断しても再実行で続きから）
- 反映: --merge で stations.geojson の各 feature.properties に name_en を書き込む

使い方:
    PYTHONUTF8=1 python scripts/generate_station_names_en.py --dry-run
    PYTHONUTF8=1 python scripts/generate_station_names_en.py            # 生成
    PYTHONUTF8=1 python scripts/generate_station_names_en.py --merge    # geojson へ反映
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GEOJSON = REPO_ROOT / "public" / "data" / "stations.geojson"
OUTPUT = REPO_ROOT / "public" / "data" / "station_names_en.json"
FAIL_LOG = REPO_ROOT / "scripts" / "_station_names_en_failures.json"

MODEL = "sonnet"
# 60 駅/batch だと CLI 応答が非線形に遅化して timeout する（20 駅: ~40s、40 駅: 240s+）。
# 20 駅 × 並列 worker が安定。
BATCH_SIZE = 20
LLM_TIMEOUT = 240

SYSTEM_PROMPT = (
    "You are a Japanese railway station name romanization expert. "
    "You convert Japanese station names to the exact romanized form used on actual station "
    "signage in Japan (JR East / Tokyo Metro convention):\n"
    "- Signage-style Hepburn WITHOUT macrons: 東京→Tokyo, 両国→Ryogoku, 高円寺→Koenji\n"
    "- ん before b/m/p becomes m: 新橋→Shimbashi, 日本橋→Nihombashi, 練馬→Nerima\n"
    "- Directional/new prefixes are hyphenated: 西船橋→Nishi-Funabashi, 新横浜→Shin-Yokohama, "
    "北千住→Kita-Senju\n"
    "- Company-prefixed stations are hyphenated: 西武新宿→Seibu-Shinjuku, 京成上野→Keisei-Ueno\n"
    "- ヶ/ノ/之 follow common signage: 市ヶ谷→Ichigaya, 御茶ノ水→Ochanomizu, 雑司が谷→Zoshigaya\n"
    "- Use the OFFICIAL romanization of the operating railway when it is well known, "
    "even if it deviates from strict Hepburn.\n"
    "Output ONLY a JSON object of the form "
    '{"stations": {"日本語駅名": "Romaji", ...}} with every input name as a key, '
    "no markdown fences, no commentary."
)

# 出力値の妥当性: ASCII ラテン + ハイフン/アポストロフィ/空白/ピリオドのみ、先頭大文字
VALID_RE = re.compile(r"^[A-Z][A-Za-z'\-\. ]{1,39}$")


def call_llm(names: list[str]) -> dict[str, str]:
    user_prompt = (
        "Romanize these Japanese railway station names (Kanto region). "
        "Return JSON {\"stations\": {name: romaji}} covering ALL of them:\n"
        + "\n".join(names)
    )
    # Windows では claude が .cmd shim のため、which で実体パスを解決する。
    # また prompt は引数ではなく stdin 渡し（cmd shim の引数転送と 8191 文字制限を回避）。
    claude_bin = shutil.which("claude") or "claude"
    # 指示は stdin の先頭に同梱する。--system-prompt 引数は改行を含むと
    # Windows の .cmd shim がコマンドラインを破壊するため使わない。
    cmd = [
        claude_bin, "-p",
        "--model", MODEL,
        "--output-format", "json",
        "--no-session-persistence",
    ]
    # cwd をリポジトリ外の空ディレクトリにし、プロジェクトの CLAUDE.md / memory が
    # 子セッションに混入しないよう隔離する（混入すると指示に従わないことがある）。
    result = subprocess.run(
        cmd, input=SYSTEM_PROMPT + "\n\n" + user_prompt, cwd=tempfile.gettempdir(),
        capture_output=True, text=True, encoding="utf-8", timeout=LLM_TIMEOUT,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LLM CLI exited {result.returncode}: {result.stderr[:500]}")
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


def load_unique_names() -> list[str]:
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    names = [f["properties"]["name"] for f in geo["features"]]
    # 安定した並び（再実行時のバッチ一致のため）
    return sorted(set(names))


def load_existing() -> dict[str, str]:
    if OUTPUT.exists():
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    return {}


def save(mapping: dict[str, str]) -> None:
    OUTPUT.write_text(
        json.dumps(dict(sorted(mapping.items())), ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )


def run_batch(batch: list[str]) -> tuple[dict[str, str], list[str]]:
    """戻り値: (有効な name→romaji, 失敗した name 一覧)"""
    try:
        result = call_llm(batch)
    except Exception as e:
        print(f"  batch error: {e}", file=sys.stderr)
        return {}, batch
    ok: dict[str, str] = {}
    bad: list[str] = []
    for name in batch:
        value = result.get(name)
        if isinstance(value, str) and VALID_RE.match(value.strip()):
            ok[name] = value.strip()
        else:
            bad.append(name)
    return ok, bad


def generate(args) -> None:
    names = load_unique_names()
    done = load_existing()
    todo = [n for n in names if n not in done]
    print(f"total {len(names)} / done {len(done)} / todo {len(todo)}")
    if args.dry_run or not todo:
        return

    batches = [todo[i:i + BATCH_SIZE] for i in range(0, len(todo), BATCH_SIZE)]
    if args.max_batches:
        batches = batches[: args.max_batches]
    failures: list[str] = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(run_batch, b): i for i, b in enumerate(batches)}
        for fut in as_completed(futures):
            i = futures[fut]
            ok, bad = fut.result()
            done.update(ok)
            failures.extend(bad)
            save(done)  # バッチごと増分保存
            print(f"batch {i + 1}/{len(batches)}: +{len(ok)} ok, {len(bad)} fail "
                  f"(total {len(done)}/{len(names)})")

    # 失敗分を 1 回だけ小バッチで再試行
    if failures:
        print(f"retrying {len(failures)} failures...")
        retry_batches = [failures[i:i + 20] for i in range(0, len(failures), 20)]
        still: list[str] = []
        for b in retry_batches:
            ok, bad = run_batch(b)
            done.update(ok)
            still.extend(bad)
            save(done)
        if still:
            FAIL_LOG.write_text(json.dumps(still, ensure_ascii=False, indent=1),
                                encoding="utf-8")
            print(f"UNRESOLVED: {len(still)} names -> {FAIL_LOG}")
    print(f"finished: {len(done)}/{len(names)}")


def merge(args) -> None:
    mapping = load_existing()
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    missing = 0
    for f in geo["features"]:
        name = f["properties"]["name"]
        en = mapping.get(name)
        if en:
            f["properties"]["name_en"] = en
        else:
            missing += 1
    if missing:
        print(f"WARNING: {missing} stations have no name_en — merge aborted", file=sys.stderr)
        sys.exit(1)
    # 元ファイルと同じ compact 形式（separators 指定）で書き戻す
    GEOJSON.write_text(
        json.dumps(geo, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"merged name_en into {len(geo['features'])} features")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-batches", type=int, default=0)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--merge", action="store_true",
                    help="station_names_en.json を stations.geojson の name_en に反映")
    args = ap.parse_args()
    if args.merge:
        merge(args)
    else:
        generate(args)


if __name__ == "__main__":
    main()
