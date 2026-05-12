#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_government_rent_data.py — 政府住宅統計から市区町村別家賃データを生成

データ源: e-Stat API
統計表: 0004021452 「借家の家賃 居住室の畳数(6区分)別住宅の１か月当たり家賃(借家)
                  －全国、都道府県、市区町村」
調査年: 令和 5 年（2023 年）、5 年に 1 回更新

抽出条件:
  - cat01=0 (総数、全畳数の平均)
  - cat02=2 (家賃 0 円を含まない、社宅・公営除く民間賃貸ベース)
  - area: 関東 8 都県 (08茨城 / 09栃木 / 10群馬 / 11埼玉 / 12千葉 / 13東京 / 14神奈川 / 19山梨)

出力: public/data/government_rent_data.json
  - areas: { jis_code: { name, pref, rent_yen, parent_path } }
  - 末端市区町村（区・市・町・村）レベルのみ、都道府県・政令市まとめは除外

使い方:
  PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_government_rent_data.py
"""

import sys, json, urllib.request, urllib.parse
from pathlib import Path

# 関東 8 都県の JIS code prefix
KANTO_PREFS = {
    '08': '茨城県', '09': '栃木県', '10': '群馬県', '11': '埼玉県',
    '12': '千葉県', '13': '東京都', '14': '神奈川県', '19': '山梨県',
}

STATS_ID = '0004021452'
SUFFIX = '都'
# 「○○県」「○○府」「東京都」「北海道」のパターン
PREF_NAMES = ['北海道'] + [f'{p}県' for p in [
    '青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉',
    '千葉','神奈川','新潟','富山','石川','福井','山梨','長野','岐阜','静岡',
    '愛知','三重','滋賀','京都府','大阪府','兵庫','奈良','和歌山','鳥取',
    '島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀',
    '長崎','熊本','大分','宮崎','鹿児島','沖縄',
]] + ['東京都', '京都府', '大阪府']


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists(): return env
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'): continue
        if '=' in line:
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_metadata(app_id: str) -> dict:
    """area code → {name, parent_code} のマップを返す"""
    url = (f'https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo'
           f'?appId={app_id}&statsDataId={STATS_ID}')
    with urllib.request.urlopen(url, timeout=30) as r:
        meta = json.loads(r.read().decode('utf-8'))
    class_obj = meta['GET_META_INFO']['METADATA_INF']['CLASS_INF']['CLASS_OBJ']
    if isinstance(class_obj, dict): class_obj = [class_obj]

    areas = {}
    for co in class_obj:
        if co.get('@id') != 'area': continue
        items = co.get('CLASS', [])
        if isinstance(items, dict): items = [items]
        for it in items:
            code = it['@code']
            name = it['@name']
            parent = it.get('@parentCode', '') or ''
            areas[code] = {'name': name, 'parent_code': parent}
    return areas


def fetch_data(app_id: str) -> list:
    """0004021452 全データ取得（cat01=0, cat02=2 で絞る）"""
    all_values = []
    start_pos = 1
    while True:
        params = {
            'appId':       app_id,
            'statsDataId': STATS_ID,
            'cdCat01':     '0',
            'cdCat02':     '2',
            'limit':       2000,
            'startPosition': start_pos,
        }
        url = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?' + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=60) as r:
            data = json.loads(r.read().decode('utf-8'))
        stat = data['GET_STATS_DATA']['STATISTICAL_DATA']
        result = stat.get('RESULT_INF', {})
        values = stat.get('DATA_INF', {}).get('VALUE', [])
        if isinstance(values, dict): values = [values]
        all_values.extend(values)
        next_pos = result.get('NEXT_KEY')
        if not next_pos: break
        start_pos = next_pos
        print(f'  ... 取得中: {len(all_values)} 件')
    return all_values


def build_pref_chain(code: str, areas: dict) -> list:
    """area code から都道府県までの parent chain を遡って [pref, ..., 末端] を返す"""
    chain = []
    cur = code
    visited = set()
    while cur and cur in areas and cur not in visited:
        visited.add(cur)
        info = areas[cur]
        chain.append(info['name'])
        cur = info['parent_code']
    return list(reversed(chain))  # [都道府県, [政令市], 末端]


def main():
    env = load_env(Path('.env.local'))
    app_id = env.get('E_STAT_APP_ID')
    if not app_id:
        print('❌ .env.local に E_STAT_APP_ID がない'); sys.exit(1)
    print(f'✅ appId 読込 (長さ {len(app_id)})')

    print('\n📋 Step 1: area メタデータ取得')
    areas_meta = fetch_metadata(app_id)
    print(f'  全 area: {len(areas_meta)} 件')

    print('\n📊 Step 2: 家賃データ取得（cat01=0, cat02=2）')
    all_values = fetch_data(app_id)
    print(f'  取得完了: {len(all_values)} 件')

    print('\n🔧 Step 3: 関東 8 都県のみ抽出 + parent chain 解決')
    kanto_areas = {}
    for v in all_values:
        code = v['@area']
        prefix = code[:2]
        if prefix not in KANTO_PREFS: continue
        # 都道府県レベル（XX000）はスキップ、政令市まとめ（XX100/XX200）もスキップしたい
        if code.endswith('000'): continue  # 都道府県全体
        # 政令市まとめは parent_code が XX000 かつ name 末尾「市」
        info = areas_meta.get(code)
        if not info: continue
        name = info['name']
        # 政令市まとめ（札幌市、横浜市 等で区を持つもの）の親に位置するエントリは
        # 「○○市」だが parent=XX000、その下に「中央区」等を持つ。スキップしたい。
        # でも一般市（区を持たない）の「○○市」も parent=XX000、これは末端なので残す。
        # → 区分判定: 同 area code を持つ子レコードが存在する場合 = 政令市まとめ、スキップ
        is_parent_of_others = any(
            ai['parent_code'] == code for ai in areas_meta.values()
        )
        if is_parent_of_others: continue

        try:
            rent_yen = int(v['$'])
        except (ValueError, TypeError):
            continue

        chain = build_pref_chain(code, areas_meta)
        pref_name = chain[0] if chain else KANTO_PREFS[prefix]
        # full_path: 都道府県 + 政令市（あれば） + 末端
        full_path = ''.join(chain)

        kanto_areas[code] = {
            'name':      name,
            'pref':      pref_name,
            'full_path': full_path,
            'rent_yen':  rent_yen,
        }

    print(f'  関東末端市区町村: {len(kanto_areas)} 件')

    print('\n💾 Step 4: government_rent_data.json 出力')
    out = {
        '_meta': {
            'source':         '総務省統計局「住宅・土地統計調査」（令和5年=2023年）',
            'stats_table_id': STATS_ID,
            'table_title':    '借家の家賃 居住室の畳数(6区分)別住宅の１か月当たり家賃(借家)',
            'fetched_at':     '2026-05-13',
            'extraction':     '畳数総数 (cat01=0) × 家賃０円を含まない (cat02=2)',
            'pref_filter':    list(KANTO_PREFS.values()),
            'unit_raw':       '円（月家賃）',
            'unit_display':   '万円（÷10000）',
            'area_count':     len(kanto_areas),
            'disclaimer':     '市区町村単位の借家全体の中央値。新築・徒歩限定の SUUMO データと比べて広範囲のため、相場の全体感の baseline として利用',
        },
        'areas': kanto_areas,
    }
    out_path = Path('public/data/government_rent_data.json')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  ✅ {out_path}')

    print('\n📍 関東主要地のサンプル（10 件）:')
    samples = ['港区', '渋谷区', '新宿区', '世田谷区', '横浜市西区', '川崎市中原区',
               '吉祥寺', 'さいたま市浦和区', '船橋市', '柏市', '町田市', '川口市']
    found_count = 0
    for code, a in kanto_areas.items():
        for s in samples:
            if s in a['name'] or s == a['full_path']:
                print(f'  {a["full_path"]:<25s} ({code}): {a["rent_yen"]:>7,} 円 = {a["rent_yen"]/10000:.2f} 万円')
                found_count += 1
                break
        if found_count >= 12: break

if __name__ == '__main__':
    main()
