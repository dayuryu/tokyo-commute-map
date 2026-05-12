#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_station_government_rent.py — station.csv の address フィールドから
市区町村を抽出し、government_rent_data.json と join して
station_code → 月家賃（円） の lookup map を生成する。

出力: public/data/station_government_rent.json
  { "_meta": {...}, "stations": { "1130208": 130000, ... } }

事前条件:
  - public/data/government_rent_data.json (e-Stat 由来)
  - ../station_database/out/main/station.csv

使い方:
  PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_station_government_rent.py
"""

import sys, csv, json, re
from pathlib import Path

# 関東 8 都県の prefecture code（station_database 由来、JIS と同じ 1-based 番号）
KANTO_PREFS = {8, 9, 10, 11, 12, 13, 14, 19}

# prefecture code → 都道府県名
PREF_NAME_BY_CODE = {
    8: '茨城県', 9: '栃木県', 10: '群馬県', 11: '埼玉県',
    12: '千葉県', 13: '東京都', 14: '神奈川県', 19: '山梨県',
}

# 政令指定都市（区を持つ）— address に「○○市△△区」と書かれている場合は
# 「市 + 区」を末端と扱う必要がある。政府データ側でも「○○市△△区」が
# parent_chain で繋がっている。
ORDINANCE_CITIES = {
    'さいたま市', '千葉市', '横浜市', '川崎市', '相模原市',
}


def parse_address(address: str, pref_code: int, area_lookup: dict) -> tuple:
    """
    address から (都道府県名, 末端市区町村名) を抽出する lookup-driven な実装。

    戦略:
      1. 「都道府県」prefix を剥がす
      2. 「○○郡」prefix を剥がす（政府データに郡粒度なし）
      3. 政令市判定: 先頭が「○○市△△区」なら「△△区」を抽出
      4. 一般: body 中の各「市/町/村/区」位置を末尾候補として
         **短い順に** area_lookup でヒット判定、最初に命中したものを返す。
         こうすると「新宿区市ヶ谷」は「新宿区」で正解にヒット、
         「東村山市」は「東村」ハズレ後「東村山市」で命中する。
    """
    pref = PREF_NAME_BY_CODE.get(pref_code)
    if not pref or not address:
        return None, None

    body = address
    if body.startswith(pref):
        body = body[len(pref):]
    body = re.sub(r'^[^\s\d０-９]+?郡', '', body)

    # 政令市
    for city in ORDINANCE_CITIES:
        if body.startswith(city):
            rest = body[len(city):]
            m = re.match(r'^([^\s\d０-９]+?区)', rest)
            if m and (pref, city + m.group(1)) in area_lookup:
                return pref, city + m.group(1)
            if (pref, city) in area_lookup:
                return pref, city
            return pref, None

    # 一般: 短い候補から area_lookup と照合
    for m in re.finditer(r'[市町村区]', body):
        cand = body[:m.end()]
        # 候補に空白・数字が含まれていれば不正なのでスキップ
        if not re.match(r'^[^\s\d０-９]+$', cand):
            continue
        if (pref, cand) in area_lookup:
            return pref, cand
    return pref, None


def build_area_lookup(gov_data: dict) -> dict:
    """
    government_rent_data.json の areas を「都道府県+末端名」→ rent_yen の lookup に変換。
    キー例:
      ('東京都', '港区')   → 196115
      ('神奈川県', '川崎市中原区') → ...
      ('東京都', '町田市') → 61189
    """
    lookup = {}
    for code, a in gov_data['areas'].items():
        pref = a['pref']
        name = a['name']
        full = a['full_path']
        # 末端名は name そのまま。政令市の区の場合「中原区」になっているが、
        # full_path = 「神奈川県川崎市中原区」なのでキー候補 2 種類用意。
        rent = a['rent_yen']
        # キー 1: (pref, name) — 港区・町田市・船橋市 等
        lookup[(pref, name)] = rent
        # キー 2: (pref, full_path[後ろ]) — 政令市の区を「川崎市中原区」形式で
        # 例: full = 「神奈川県川崎市中原区」、pref = 「神奈川県」、suffix = 「川崎市中原区」
        if full.startswith(pref):
            suffix = full[len(pref):]
            # 「特別区部港区」のようなものは「港区」だけ残したいので「特別区部」を剥がす
            suffix = suffix.replace('特別区部', '')
            if suffix and (pref, suffix) not in lookup:
                lookup[(pref, suffix)] = rent
    return lookup


def main():
    # 政府データ読込
    gov_path = Path('public/data/government_rent_data.json')
    if not gov_path.exists():
        print(f'❌ {gov_path} が無い。先に scripts/build_government_rent_data.py を実行')
        sys.exit(1)
    with open(gov_path, encoding='utf-8') as f:
        gov_data = json.load(f)
    print(f'✅ 政府データ: {len(gov_data["areas"])} 市区町村')

    area_lookup = build_area_lookup(gov_data)
    print(f'  area lookup キー数: {len(area_lookup)}')

    # station.csv 読込
    db_path = Path('../station_database/out/main/station.csv')
    if not db_path.exists():
        print(f'❌ {db_path} が無い'); sys.exit(1)

    matched = {}
    unmatched_samples = []
    total_kanto = 0
    with open(db_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['closed'].strip() == 'true': continue
            try:
                pref_code = int(row['prefecture'])
                code = int(row['code'])
            except ValueError:
                continue
            if pref_code not in KANTO_PREFS: continue
            total_kanto += 1

            pref, ward = parse_address(row['address'], pref_code, area_lookup)
            if not ward:
                if len(unmatched_samples) < 10:
                    unmatched_samples.append((row['name'], row['address']))
                continue

            rent = area_lookup.get((pref, ward))
            if rent is None:
                if len(unmatched_samples) < 10:
                    unmatched_samples.append((row['name'], f'{pref}/{ward} (政府データ無)'))
                continue

            matched[code] = rent

    print(f'\n📊 関東駅総数: {total_kanto}')
    print(f'   政府データに match: {len(matched)} ({100*len(matched)/total_kanto:.1f}%)')
    if unmatched_samples:
        print(f'\n⚠️ unmatched sample (10):')
        for n, a in unmatched_samples:
            print(f'   {n} — {a}')

    out = {
        '_meta': {
            'source':           '総務省統計局「住宅・土地統計調査」(令和5年=2023年) を駅にマッピング',
            'parent_data':      'public/data/government_rent_data.json',
            'unit_raw':         '円（月家賃）',
            'unit_display':     '万円（÷10000）',
            'station_count':    len(matched),
            'kanto_total':      total_kanto,
            'coverage':         f'{100*len(matched)/total_kanto:.1f}%',
            'disclaimer':       '駅が属する市区町村全体の借家中央値（民間賃貸ベース、家賃０円除外、全畳数）。新築・徒歩限定の SUUMO データと比べて広範囲、相場の baseline として参照',
        },
        'stations': matched,
    }
    out_path = Path('public/data/station_government_rent.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'\n💾 出力: {out_path}')

if __name__ == '__main__':
    main()
