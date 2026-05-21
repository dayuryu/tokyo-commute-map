"""
人工 paste workflow の結果を public/data/area_features_<lang>.json に統合する。

generate_area_features_prompts.py で吐き出した batch_NN.md prompt を
主人が Claude.ai web に貼り付け、返答 JSON を batch_NN.json として
_handoff/<lang>_responses/ に保存した後、このスクリプトを実行する。

使い方:
    python scripts/merge_area_features_responses.py --lang zh
    python scripts/merge_area_features_responses.py --lang zh --strict   # 検証エラーで exit 1
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_area_features import (  # noqa: E402
    OUTPUT_FOR_LANG,
    LANG_VALIDATION,
    validate_value,
    parse_stations,
    INPUT_MD,
    BATCH1_JSON,
    HANDOFF_DIR,
    REPO_ROOT,
)

RESPONSES_DIR_FOR_LANG = {
    "ja": HANDOFF_DIR / "ja_responses",
    "zh": HANDOFF_DIR / "zh_responses",
    "en": HANDOFF_DIR / "en_responses",
}


def parse_response_file(path: Path) -> dict[str, str]:
    """1 batch 分の response JSON を読む。JSON object の直書きでも
    code fence 付きでも受け入れる。"""
    raw = path.read_text(encoding="utf-8").strip()
    # code fence を脱ぐ
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    payload = json.loads(raw)
    if isinstance(payload, dict) and "stations" in payload:
        stations = payload["stations"]
    else:
        # Claude.ai が `stations` ラッパー無しで返した場合の救済
        stations = payload
    if not isinstance(stations, dict):
        raise ValueError(f"{path.name}: 'stations' is not a dict")
    return stations


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["ja", "zh", "en"], required=True)
    ap.add_argument("--strict", action="store_true",
                    help="検証エラーがあれば exit 1（CI 用）")
    args = ap.parse_args()
    lang = args.lang
    responses_dir = RESPONSES_DIR_FOR_LANG[lang]
    output_path = OUTPUT_FOR_LANG[lang]

    if not responses_dir.exists():
        print(f"[error] {responses_dir} がありません。先に generate_area_features_prompts.py を実行してください。", file=sys.stderr)
        sys.exit(2)

    response_files = sorted(responses_dir.glob("batch_*.json"))
    if not response_files:
        print(f"[error] {responses_dir} に batch_*.json が 1 つもありません。", file=sys.stderr)
        sys.exit(2)
    print(f"[info] lang={lang}, response files: {len(response_files)}")

    # 既存の output (途中まで merge 済) があれば、そこに追記
    if output_path.exists():
        merged = json.loads(output_path.read_text(encoding="utf-8"))
        if "stations" not in merged:
            merged["stations"] = {}
    else:
        merged = {"_meta": {}, "stations": {}}

    # ja の場合は batch1 を seed として含める
    if lang == "ja":
        batch1 = json.loads(BATCH1_JSON.read_text(encoding="utf-8"))
        merged["stations"].update(batch1["stations"])

    total_added = 0
    validation_errors: list[tuple[str, str, str, str]] = []  # (batch_file, station, error, value)
    for path in response_files:
        try:
            stations = parse_response_file(path)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  ✗ {path.name}: parse failed: {e}", file=sys.stderr)
            if args.strict:
                sys.exit(1)
            continue

        batch_added = 0
        for name, value in stations.items():
            err = validate_value(value, lang)
            if err:
                validation_errors.append((path.name, name, err, str(value)[:80]))
                # validation error でも値が文字列なら一応保存（後で手修正できるよう）
                if isinstance(value, str):
                    merged["stations"][name] = value
                    batch_added += 1
                continue
            merged["stations"][name] = value
            batch_added += 1
        total_added += batch_added
        print(f"  ✓ {path.name}: +{batch_added} stations (total stations now: {len(merged['stations'])})")

    # meta 更新
    all_stations = parse_stations(INPUT_MD)
    merged["_meta"]["language"] = lang
    merged["_meta"]["generator"] = "Claude.ai (Sonnet 4.5) via manual paste workflow"
    merged["_meta"]["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    merged["_meta"]["station_count_target"] = len(all_stations)
    merged["_meta"].setdefault("disclaimer", {
        "ja": "AI 生成的参考情报、最新实况建议现地确认",
        "zh": "AI 生成的参考信息，最新情况建议现地确认",
        "en": "AI-generated reference info; verify locally for current conditions",
    }[lang])

    # 出力
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print()
    print(f"[done] merged {total_added} stations from {len(response_files)} batches")
    print(f"[done] coverage: {len(merged['stations'])} / {len(all_stations)} stations")
    print(f"[done] output → {output_path.relative_to(REPO_ROOT)}")

    if validation_errors:
        print()
        print(f"[warn] {len(validation_errors)} validation errors (still merged, manually fix if needed):")
        for batch_file, name, err, value in validation_errors[:20]:
            print(f"  {batch_file} :: {name}: {err} → {value}")
        if len(validation_errors) > 20:
            print(f"  ... and {len(validation_errors) - 20} more")
        if args.strict:
            sys.exit(1)


if __name__ == "__main__":
    main()
