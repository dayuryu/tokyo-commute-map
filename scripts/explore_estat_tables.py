#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explore_estat_tables.py — e-Stat の「住宅・土地統計調査」(toukei=00200522)
最新版 (2023年=令和5年) の統計表一覧から「家賃」を含む表を列挙する。

appId は .env.local の E_STAT_APP_ID を使用（コードには書かない）。
出力は表 ID + タイトルのみ、appId は隠蔽する。

使い方:
  PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/explore_estat_tables.py
"""

import os, sys, json, urllib.request, urllib.parse
from pathlib import Path

def load_env(path: Path) -> dict:
    """簡易 .env パーサ（コメントと空行を無視）"""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    env = load_env(Path('.env.local'))
    app_id = env.get('E_STAT_APP_ID')
    if not app_id:
        print('❌ .env.local に E_STAT_APP_ID がない')
        sys.exit(1)
    print(f'✅ appId 読込 (長さ {len(app_id)})')

    # e-Stat API getStatsList: 住宅・土地統計調査 2023 年版の表一覧
    # 全部だと多いので「家賃」キーワードで絞る
    base = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList'
    params = {
        'appId':       app_id,
        'statsCode':   '00200522',  # 住宅・土地統計調査
        'searchWord':  '家賃',       # AND 検索
        'surveyYears': '2023',       # 令和5年
        'limit':       100,
    }
    url = base + '?' + urllib.parse.urlencode(params)

    print(f'🌐 fetch: {url.replace(app_id, "***")}')
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        print(f'❌ API エラー: {e}')
        sys.exit(1)

    result = data.get('GET_STATS_LIST', {}).get('DATALIST_INF', {})
    total = result.get('NUMBER', 0)
    table_inf = result.get('TABLE_INF', [])
    if isinstance(table_inf, dict):
        table_inf = [table_inf]

    print(f'\n📊 該当統計表: {total} 件\n')
    for t in table_inf:
        tid = t.get('@id', '?')
        title = t.get('TITLE', '')
        if isinstance(title, dict):
            title = title.get('$', '') + f' (#{title.get("@no", "")})'
        ssize = t.get('STATISTICS_NAME', '')
        cycle = t.get('SURVEY_DATE', '')
        gov_org = t.get('GOV_ORG', {}).get('$', '')

        # 市区町村粒度を持つかの目安: 「市区町村」「地域」「都道府県」を含むか
        if any(kw in title for kw in ['市区町村', '地域', '都道府県別', '区']):
            mark = '⭐'
        else:
            mark = '  '
        print(f'{mark} [{tid}] {title}')

    print('\n⭐ = 地域粒度ありそうな表（市区町村 / 地域 / 都道府県別 を含む）')

if __name__ == '__main__':
    main()
