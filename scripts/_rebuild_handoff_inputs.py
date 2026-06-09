#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次性: _handoff/ 入力を本機で再構築する (station_database/station.csv が無い環境用)。

build_handoff_stations_list.py は ../station_database/out/main/station.csv から
都道府県を引くが、当該データ管線は本機に無い。代わりにリポジトリ内の
public/data/station_pref.json (code → 都道府県名) を使って同一フォーマットの
stations_for_features.md を再生成する。

併せて batch1_完成サンプル.json を ja area_features.json の先頭エントリから
再構築する (en 生成では存在さえすれば内容は出力に影響しない。line 460 で読まれ、
dry-run の層化サンプリング除外にのみ使われるため)。

generate_area_features.py の parse_stations が読む正確なフォーマット:
  SECTION_RE  = r"^## (.+?)（(\d+) 駅）$"
  STATION_RE  = r"^- \*\*(.+?)\*\* — (.+?) — 新宿 (.+)$"
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
HANDOFF = REPO.parent / "_handoff"
HANDOFF.mkdir(parents=True, exist_ok=True)

geojson = json.loads((REPO / "public/data/stations.geojson").read_text(encoding="utf-8"))
station_pref = json.loads((REPO / "public/data/station_pref.json").read_text(encoding="utf-8"))

# build_handoff_stations_list.py と同じ 8 都県 + code 順
PREF_ORDER = ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県"]
KANTO = set(PREF_ORDER)

by_pref: dict[str, list[dict]] = {}
no_pref = 0
non_kanto = 0
for feat in geojson["features"]:
    p = feat["properties"]
    code = str(p["code"])
    pref = station_pref.get(code)
    if pref is None:
        # pref 不明 → 落とさず「関東(都県不明)」に寄せ、coverage を ja と揃える
        pref = "関東(都県不明)"
        no_pref += 1
    elif pref not in KANTO:
        non_kanto += 1
    by_pref.setdefault(pref, []).append({
        "name": p["name"],
        "lines": (p.get("line_names") or [])[:3],
        "min_shinjuku": p.get("min_to_shinjuku"),
    })

# セクション順: 8 都県を code 順、その後にそれ以外
ordered_prefs = [pp for pp in PREF_ORDER if pp in by_pref] + \
                [pp for pp in by_pref if pp not in PREF_ORDER]

lines_out: list[str] = []
total = sum(len(v) for v in by_pref.values())
lines_out.append(f"# 関東 {total} 駅一覧（周辺の特徴生成用）")
lines_out.append("")
lines_out.append("各駅の情報: `駅名` / 主要路線 / 新宿駅まで X 分")
lines_out.append("")
for pref in ordered_prefs:
    stations = sorted(
        by_pref[pref],
        key=lambda s: (s["min_shinjuku"] if s["min_shinjuku"] is not None else 999, s["name"]),
    )
    lines_out.append("")
    lines_out.append(f"## {pref}（{len(stations)} 駅）")
    lines_out.append("")
    for s in stations:
        ln = "・".join(s["lines"]) if s["lines"] else "（路線データ無）"
        mins = f"{s['min_shinjuku']}分" if s["min_shinjuku"] is not None else "到達不可"
        lines_out.append(f"- **{s['name']}** — {ln} — 新宿 {mins}")

(HANDOFF / "stations_for_features.md").write_text("\n".join(lines_out) + "\n", encoding="utf-8")

# batch1_完成サンプル.json — ja の先頭 101 駅 (内容は en 出力に影響しないが、
# 存在 + valid JSON + 非空 stations dict が必須)
ja = json.loads((REPO / "public/data/area_features.json").read_text(encoding="utf-8"))
batch1 = dict(list(ja["stations"].items())[:101])
(HANDOFF / "batch1_完成サンプル.json").write_text(
    json.dumps({"stations": batch1}, ensure_ascii=False, indent=2), encoding="utf-8"
)

print(f"[ok] stations_for_features.md: {total} 駅")
print(f"     都県不明: {no_pref} / 非関東(参考): {non_kanto}")
print(f"     セクション: {[(pp, len(by_pref[pp])) for pp in ordered_prefs]}")
print(f"[ok] batch1_完成サンプル.json: {len(batch1)} 駅")
