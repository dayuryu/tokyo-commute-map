#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
e-Stat 表 0004021452 のメタデータと一部データを確認する。

表内容: 借家の家賃 居住室の畳数(6区分)別住宅の１か月当たり家賃(借家)
       －全国、都道府県、市区町村

確認したい事:
  1. データ列の構造（畳数区分、地域、家賃の単位など）
  2. 関東地方の市区町村数
  3. データの「家賃」が円か千円か百円か
  4. NULL や「‐」のエンコーディング
"""

import os, sys, json, urllib.request, urllib.parse
from pathlib import Path
from collections import Counter

def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'): continue
        if '=' in line:
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    env = load_env(Path('.env.local'))
    app_id = env['E_STAT_APP_ID']

    # まずメタデータ
    print('=' * 60)
    print('📋 STEP 1: getMetaInfo でメタデータ取得')
    print('=' * 60)
    url = (f'https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo'
           f'?appId={app_id}&statsDataId=0004021452')
    with urllib.request.urlopen(url, timeout=30) as r:
        meta = json.loads(r.read().decode('utf-8'))

    class_inf = meta.get('GET_META_INFO', {}).get('METADATA_INF', {}).get('CLASS_INF', {})
    class_obj = class_inf.get('CLASS_OBJ', [])
    if isinstance(class_obj, dict): class_obj = [class_obj]

    for co in class_obj:
        cid = co.get('@id')
        cname = co.get('@name')
        items = co.get('CLASS', [])
        if isinstance(items, dict): items = [items]
        print(f'\n▸ classObj id={cid} name="{cname}"  ({len(items)} 件)')
        # 先頭 5 件だけ表示
        for it in items[:5]:
            print(f'    [{it.get("@code")}] {it.get("@name")}  parentCode={it.get("@parentCode","")}')
        if len(items) > 5:
            print(f'    ... 残り {len(items) - 5} 件')

    # 次に実データ少量取得（東京 23 区だけ）
    print('\n')
    print('=' * 60)
    print('📊 STEP 2: getStatsData で東京都の一部だけ取得')
    print('=' * 60)

    # 東京 23 区の area code は 13101-13123
    # ただし e-Stat 標準地域コードは別形式の可能性、まずは limit=20 でフェッチして見る
    params = {
        'appId':       app_id,
        'statsDataId': '0004021452',
        'limit':       30,
    }
    url2 = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url2, timeout=30) as r:
        data = json.loads(r.read().decode('utf-8'))

    stat_data = data.get('GET_STATS_DATA', {}).get('STATISTICAL_DATA', {})
    result_inf = stat_data.get('RESULT_INF', {})
    print(f'\n総件数: {result_inf.get("TOTAL_NUMBER", "?")}')
    print(f'今回取得: {result_inf.get("FROM_NUMBER", "?")}-{result_inf.get("TO_NUMBER", "?")}')

    values = stat_data.get('DATA_INF', {}).get('VALUE', [])
    if isinstance(values, dict): values = [values]
    print(f'\n先頭 10 件のデータ:')
    for v in values[:10]:
        print(f'  {dict(v)}')

if __name__ == '__main__':
    main()
