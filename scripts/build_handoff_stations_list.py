#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_handoff_stations_list.py

stations.geojson と line_styles.json から 1843 駅の clean な markdown table を生成、
小雪（Claude.ai 网页版）に「周辺の特徴」生成タスクを依頼する handoff 用。

出力: _handoff/stations_for_features.md
  - 関東 8 都県別にセクション分け
  - 各駅: 駅名 / 主要路線（最大 3 つ）/ 新宿までの通勤時間
  - 沿線で繋がる順番に並べ、小雪が文脈で推論しやすく

使い方:
  PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_handoff_stations_list.py
"""

import sys, csv, json
from pathlib import Path
from collections import defaultdict

# 関東 8 都県の prefecture code → name
PREF_NAME_BY_CODE = {
    8: '茨城県', 9: '栃木県', 10: '群馬県', 11: '埼玉県',
    12: '千葉県', 13: '東京都', 14: '神奈川県', 19: '山梨県',
}
KANTO_PREFS = set(PREF_NAME_BY_CODE.keys())


def main():
    geojson_path = Path('public/data/stations.geojson')
    if not geojson_path.exists():
        print(f'❌ {geojson_path} が無い'); sys.exit(1)
    with open(geojson_path, encoding='utf-8') as f:
        geojson = json.load(f)

    # station.csv から prefecture code 取得（geojson に prefecture 入ってないため）
    db_path = Path('../station_database/out/main/station.csv')
    if not db_path.exists():
        print(f'❌ {db_path} が無い'); sys.exit(1)

    station_pref = {}  # code → prefecture int
    with open(db_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            try:
                code = int(row['code'])
                pref = int(row['prefecture'])
                station_pref[code] = pref
            except ValueError:
                continue

    # geojson 駅を都道府県別にグループ化
    by_pref = defaultdict(list)
    for feat in geojson['features']:
        p = feat['properties']
        code = p['code']
        pref_code = station_pref.get(code)
        if pref_code not in KANTO_PREFS: continue
        lines = p.get('line_names', [])[:3]  # 最大 3 路線
        min_shinjuku = p.get('min_to_shinjuku')
        by_pref[pref_code].append({
            'name':         p['name'],
            'lines':        lines,
            'min_shinjuku': min_shinjuku,
        })

    # 出力
    out_path = Path('../_handoff/stations_for_features.md')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        total = sum(len(v) for v in by_pref.values())
        f.write(f'# 関東 {total} 駅一覧（周辺の特徴生成用）\n\n')
        f.write('各駅の情報: `駅名` / 主要路線 / 新宿駅まで X 分\n\n')

        # 都道府県別、新宿までの時間でソート（地理的に近い順）
        for pref_code in sorted(by_pref.keys()):
            pref_name = PREF_NAME_BY_CODE[pref_code]
            stations = sorted(
                by_pref[pref_code],
                key=lambda s: (s['min_shinjuku'] if s['min_shinjuku'] is not None else 999, s['name']),
            )
            f.write(f'\n## {pref_name}（{len(stations)} 駅）\n\n')
            for s in stations:
                lines = '・'.join(s['lines']) if s['lines'] else '（路線データ無）'
                mins = f"{s['min_shinjuku']}分" if s['min_shinjuku'] is not None else '到達不可'
                f.write(f"- **{s['name']}** — {lines} — 新宿 {mins}\n")

    print(f'✅ {out_path}')
    for pref_code, sts in sorted(by_pref.items()):
        print(f'  {PREF_NAME_BY_CODE[pref_code]}: {len(sts)} 駅')
    print(f'  合計: {sum(len(v) for v in by_pref.values())}')


if __name__ == '__main__':
    main()
