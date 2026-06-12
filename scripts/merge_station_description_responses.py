#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_handoff/station_desc_responses/batch_NN.json を検証して
public/data/station_descriptions.json に合体する。

検証:
  - 150 駅（station-batch1-candidates.json）の全キーが揃っている
  - 余計なキー・重複キーが無い
  - 各本文 150〜250 字、改行を含まない

使い方:
  PYTHONIOENCODING=utf-8 python scripts/merge_station_description_responses.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESPONSES_DIR = ROOT / "_handoff" / "station_desc_responses"
CANDIDATES = ROOT / "docs" / "research" / "station-batch1-candidates.json"
OUT = ROOT / "public" / "data" / "station_descriptions.json"


def main() -> None:
    expected = [s["name"] for s in json.loads(CANDIDATES.read_text(encoding="utf-8"))]
    expected_set = set(expected)

    merged: dict[str, str] = {}
    errors: list[str] = []

    files = sorted(RESPONSES_DIR.glob("batch_*.json"))
    if not files:
        print(f"❌ no response files in {RESPONSES_DIR}")
        sys.exit(1)

    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        for name, text in data["stations"].items():
            if name in merged:
                errors.append(f"{f.name}: duplicate key {name}")
            if name not in expected_set:
                errors.append(f"{f.name}: unexpected key {name}")
            if "\n" in text:
                errors.append(f"{f.name}: {name} contains newline")
            if not (150 <= len(text) <= 250):
                errors.append(f"{f.name}: {name} length {len(text)} out of [150,250]")
            merged[name] = text

    missing = [n for n in expected if n not in merged]
    for n in missing:
        errors.append(f"missing key: {n}")

    if errors:
        print(f"❌ {len(errors)} validation errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    out = json.loads(OUT.read_text(encoding="utf-8"))
    out["stations"] = {n: merged[n] for n in expected}  # batch1 の需要順を保つ
    out["_meta"]["generated"] = "2026-06-12"
    out["_meta"]["count"] = len(expected)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    lengths = sorted(len(t) for t in merged.values())
    print(f"✅ merged {len(merged)} stations -> {OUT.relative_to(ROOT)}")
    print(f"   length min/median/max: {lengths[0]} / {lengths[len(lengths)//2]} / {lengths[-1]}")


if __name__ == "__main__":
    main()
