"""
1843 駅「周辺の特徴」prompt 生成スクリプト（人工 Claude.ai paste 用）

============================================================
旧 ja 版を生成した workflow を中文 / 英文版用に復活させる:
  1. 本スクリプトで batch_NN.md を _handoff/<lang>_prompts/ に生成
  2. 主人が各 batch_NN.md を全選コピー → Claude.ai web (Sonnet) に paste
  3. Claude.ai が返した JSON を _handoff/<lang>_responses/batch_NN.json に保存
  4. `merge_area_features_responses.py --lang <lang>` で
     public/data/area_features_<lang>.json に合体

なぜ CLI subprocess version (generate_area_features.py --lang zh) を使わないか:
  Claude CLI は 1 batch ≈ 16 分かかり、1200s hard timeout の壁にぶつかる。
  Claude.ai web には timeout が無く、Sonnet が落ち着いて出力できる。
============================================================

使い方:
    # zh 版 batch 全部生成
    python scripts/generate_area_features_prompts.py --lang zh

    # batch_size を変えたい場合（既定 40 駅/batch）
    python scripts/generate_area_features_prompts.py --lang zh --batch-size 30

    # 既存の zh_responses/ にあるものは skip して残り batch だけ作る
    python scripts/generate_area_features_prompts.py --lang zh --skip-done
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# 同じディレクトリの generate_area_features.py から定義を import 再利用。
# システムプロンプト / few-shot / 言語ごとのテキストは SSOT を 1 ファイルに保つため。
sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_area_features import (  # noqa: E402
    SYSTEM_PROMPT_FOR_LANG,
    USER_PROMPT_TEXTS,
    FEW_SHOT_EXAMPLES,
    parse_stations,
    INPUT_MD,
    BATCH1_JSON,
    HANDOFF_DIR,
)

DEFAULT_BATCH_SIZE = 40

# lang ごとの prompts / responses ディレクトリ
PROMPTS_DIR_FOR_LANG = {
    "ja": HANDOFF_DIR / "ja_prompts",
    "zh": HANDOFF_DIR / "zh_prompts",
    "en": HANDOFF_DIR / "en_prompts",
}

RESPONSES_DIR_FOR_LANG = {
    "ja": HANDOFF_DIR / "ja_responses",
    "zh": HANDOFF_DIR / "zh_responses",
    "en": HANDOFF_DIR / "en_responses",
}


def build_batch_prompt(batch: list[dict], lang: str, batch_idx: int, total: int) -> str:
    """1 batch 分の paste 用 prompt 文字列を構築。
    Claude.ai web に丸ごと paste できるように、system + user を 1 つの message に統合。
    Claude.ai は system prompt を別途指定する UI が無いため、user message 冒頭に
    "# 役割設定 / # Role" として埋め込む。"""
    system = SYSTEM_PROMPT_FOR_LANG[lang]
    texts = USER_PROMPT_TEXTS[lang]
    example_json = {"stations": dict(FEW_SHOT_EXAMPLES)}
    example_block = json.dumps(example_json, ensure_ascii=False, indent=2)

    intro_role_header = {
        "ja": "# あなたの役割（必ず守ってください）",
        "zh": "# 你的角色（请务必遵守）",
        "en": "# Your role (please follow strictly)",
    }[lang]
    batch_header = {
        "ja": f"# Batch {batch_idx} / {total}（{len(batch)} 駅）",
        "zh": f"# Batch {batch_idx} / {total}（{len(batch)} 站）",
        "en": f"# Batch {batch_idx} / {total} ({len(batch)} stations)",
    }[lang]

    intro = texts["intro_ja_with_batch1"] if lang == "ja" else texts["intro_zero_shot"]

    parts = [
        intro_role_header,
        "",
        system.strip(),
        "",
        "---",
        "",
        batch_header,
        "",
        intro,
        "",
        texts["examples_label"],
        example_block,
        "",
        texts["list_label_fmt"].format(n=len(batch)),
        texts["row_header"],
        "",
    ]
    for s in batch:
        parts.append(f"- {s['name']} — {s['lines']} — {s['pref']} — 新宿 {s['commute']}")
    parts.append("")
    parts.append(texts["tail"])
    return "\n".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["ja", "zh", "en"], required=True)
    ap.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument("--skip-done", action="store_true",
                    help="<lang>_responses/batch_NN.json が既存の batch はスキップ")
    args = ap.parse_args()
    lang = args.lang

    all_stations = parse_stations(INPUT_MD)
    print(f"[info] parsed {len(all_stations)} stations from {INPUT_MD.name}")

    # ja seed: Batch 1 の駅は skip（既に手書きで完成）
    if lang == "ja":
        batch1_names = set(json.loads(BATCH1_JSON.read_text(encoding="utf-8"))["stations"].keys())
        remaining = [s for s in all_stations if s["name"] not in batch1_names]
        print(f"[info] lang=ja: skipping {len(batch1_names)} batch1 stations, generating prompts for {len(remaining)} remaining")
    else:
        remaining = all_stations[:]

    # 都道府県順にソート（同じ batch に同じ都道府県を寄せるとモデルが文脈を保ちやすい）
    pref_order = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県", "山梨県"]
    remaining.sort(key=lambda s: (
        pref_order.index(s["pref"]) if s["pref"] in pref_order else 99,
        s["commute"],
    ))

    batches = [remaining[i:i + args.batch_size] for i in range(0, len(remaining), args.batch_size)]
    total = len(batches)
    print(f"[info] split into {total} batches of up to {args.batch_size} stations")

    prompts_dir = PROMPTS_DIR_FOR_LANG[lang]
    responses_dir = RESPONSES_DIR_FOR_LANG[lang]
    prompts_dir.mkdir(parents=True, exist_ok=True)
    responses_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped = 0
    for idx, batch in enumerate(batches, start=1):
        out_file = prompts_dir / f"batch_{idx:02d}.md"
        response_file = responses_dir / f"batch_{idx:02d}.json"
        if args.skip_done and response_file.exists():
            skipped += 1
            continue
        prompt = build_batch_prompt(batch, lang, idx, total)
        out_file.write_text(prompt, encoding="utf-8")
        written += 1

    print(f"[done] wrote {written} batch prompts to {prompts_dir.relative_to(HANDOFF_DIR.parent)}/")
    if skipped:
        print(f"[done] skipped {skipped} batches that already have responses")
    print(f"[done] empty response directory ready at {responses_dir.relative_to(HANDOFF_DIR.parent)}/")
    print()
    print("Next step (主人手作業):")
    print(f"  1. 各 batch_NN.md を全選コピー → Claude.ai (Sonnet 4.5) に paste")
    print(f"  2. Claude.ai が返した JSON を {responses_dir.name}/batch_NN.json として保存")
    print(f"     (前置きや code fence ``` を取り除き、純粋な JSON object のみで保存)")
    print(f"  3. 全 batch 完了後:")
    print(f"     python scripts/merge_area_features_responses.py --lang {lang}")


if __name__ == "__main__":
    main()
