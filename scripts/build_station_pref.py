#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_station_pref.py

station.csv の prefecture フィールドから関東駅 code → 都道府県名 の lookup を生成。
AI 推薦 Wizard の候補駅フィルタ用、各駅の所在都道府県を識別する。

出力: public/data/station_pref.json
  { "1130208": "東京都", "1130201": "東京都", ... }

使い方:
  PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_station_pref.py
"""

import sys, csv, json
from pathlib import Path

PREF_NAME_BY_CODE = {
    8: '茨城県', 9: '栃木県', 10: '群馬県', 11: '埼玉県',
    12: '千葉県', 13: '東京都', 14: '神奈川県', 19: '山梨県',
}
KANTO_PREFS = set(PREF_NAME_BY_CODE.keys())


def main():
    db_path = Path('../station_database/out/main/station.csv')
    if not db_path.exists():
        print(f'❌ {db_path} が無い'); sys.exit(1)

    pref_map = {}
    with open(db_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['closed'].strip() == 'true': continue
            try:
                pref_code = int(row['prefecture'])
                code = int(row['code'])
            except ValueError:
                continue
            if pref_code not in KANTO_PREFS: continue
            pref_map[str(code)] = PREF_NAME_BY_CODE[pref_code]

    out = Path('public/data/station_pref.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(pref_map, f, ensure_ascii=False, separators=(',', ':'))
    print(f'✅ {out}: {len(pref_map)} 駅')


if __name__ == '__main__':
    main()
