#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_handoff/ward_desc_responses/batch_NN.json を検証して
public/data/ward_descriptions.json に合体する。

検証:
  - 首批 150 駅が属する全 hub（generate_ward_description_prompts.mjs と同集合）が揃っている
  - 余計なキー・重複キーが無い
  - 各本文 200〜300 字、改行を含まない

使い方:
  PYTHONIOENCODING=utf-8 python scripts/merge_ward_description_responses.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESPONSES_DIR = ROOT / "_handoff" / "ward_desc_responses"
PROMPTS_DIR = ROOT / "_handoff" / "ward_desc_prompts"
OUT = ROOT / "public" / "data" / "ward_descriptions.json"


def expected_slugs() -> list[str]:
    slugs: list[str] = []
    for f in sorted(PROMPTS_DIR.glob("batch_*.md")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.startswith("- slug: "):
                slugs.append(line.removeprefix("- slug: ").strip())
    return slugs


def main() -> None:
    expected = expected_slugs()
    expected_set = set(expected)

    merged: dict[str, str] = {}
    errors: list[str] = []

    for f in sorted(RESPONSES_DIR.glob("batch_*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for slug, text in data["wards"].items():
            if slug in merged:
                errors.append(f"{f.name}: duplicate key {slug}")
            if slug not in expected_set:
                errors.append(f"{f.name}: unexpected key {slug}")
            if "\n" in text:
                errors.append(f"{f.name}: {slug} contains newline")
            if not (200 <= len(text) <= 300):
                errors.append(f"{f.name}: {slug} length {len(text)} out of [200,300]")
            merged[slug] = text

    for s in expected:
        if s not in merged:
            errors.append(f"missing key: {s}")

    if errors:
        print(f"❌ {len(errors)} validation errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    out = {
        "_meta": {
            "purpose": "区市 hub（/area/{ward}）冒頭リード文 200-300 字。LLM 批量初稿 + 運営レビュー。",
            "workflow": "scripts/generate_ward_description_prompts.mjs で prompt 生成 → LLM → merge",
            "generated": "2026-06-12",
            "count": len(expected),
        },
        "wards": {s: merged[s] for s in expected},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    lengths = sorted(len(t) for t in merged.values())
    print(f"✅ merged {len(merged)} wards -> {OUT.relative_to(ROOT)}")
    print(f"   length min/median/max: {lengths[0]} / {lengths[len(lengths)//2]} / {lengths[-1]}")


if __name__ == "__main__":
    main()
