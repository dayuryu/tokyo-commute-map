"""
30 個の通勤目的地候補について station_database の station.csv から
station_code を逆引きするためのワンショットスクリプト。
build_stations_geojson_v3.py の DESTINATIONS 拡張に使う。
"""
import csv
import sys
from pathlib import Path

# 関東 8 都県（建設・通勤可能性のため広め）
KANTO_PREFS = {8, 9, 10, 11, 12, 13, 14, 19}  # 茨城〜静岡

# 30 個の通勤目的地（slug, name, 注釈）
# 注：「東京」は station.csv では「東京」だが UI 表示は「東京駅」
DESTINATIONS = [
    ('shinjuku',     '新宿',         '西新宿摩天楼群・新宿三丁目'),
    ('tokyo',        '東京',         '丸の内・八重洲'),
    ('shibuya',      '渋谷',         'IT・スタートアップ'),
    ('ikebukuro',    '池袋',         'サンシャイン・芸術劇場'),
    ('shinagawa',    '品川',         '港南口 IT'),
    ('tamachi',      '田町',         '三田・慶應'),
    ('hamamatsucho', '浜松町',       'モノレール拠点'),
    ('shimbashi',    '新橋',         '霞が関接続'),
    ('yurakucho',    '有楽町',       '銀座接続'),
    ('akihabara',    '秋葉原',       'UDX・IT'),
    ('osaki',        '大崎',         'ThinkPark 再開発'),
    ('gotanda',      '五反田',       'IT スタートアップ'),
    ('meguro',       '目黒',         'オフィス再開発'),
    ('takadanobaba', '高田馬場',     '早稲田'),
    ('otemachi',     '大手町',       '金融商社街'),
    ('roppongi',     '六本木',       'ヒルズ・ミッドタウン'),
    ('toranomon',    '虎ノ門',       'ヒルズ・霞が関'),
    ('akasakamitsuke','赤坂見附',    '赤坂サカス'),
    ('iidabashi',    '飯田橋',       '法政・東京理科'),
    ('kanda',        '神田',         '中規模オフィス・書店街'),
    ('ochanomizu',   '御茶ノ水',     '明治・順天堂'),
    ('omotesando',   '表参道',       'アパレル・商業'),
    ('yokohama',     '横浜',         '神奈川中心'),
    ('minatomirai',  'みなとみらい', '横浜ビジネス'),
    ('musashikosugi','武蔵小杉',     '近年再開発'),
    ('omiya',        '大宮',         '埼玉中心'),
    ('chiba',        '千葉',         '千葉県庁'),
    ('tachikawa',    '立川',         '多摩中心'),
    ('oshiage',      '押上',         'スカイツリー'),
    ('toyosu',       '豊洲',         'IMS・新興オフィス'),
]


def main(station_db: Path) -> int:
    csv_path = station_db / 'out' / 'main' / 'station.csv'
    if not csv_path.exists():
        print(f'ERROR: station.csv not found at {csv_path}', file=sys.stderr)
        return 1

    # name → list of (code, lat, lng, prefecture)
    by_name: dict[str, list[tuple[int, float, float, int]]] = {}
    with open(csv_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['closed'].strip() == 'true':
                continue
            try:
                pref = int(row['prefecture'])
            except ValueError:
                continue
            if pref not in KANTO_PREFS:
                continue
            name = row['name'].strip()
            by_name.setdefault(name, []).append((
                int(row['code']),
                float(row['lat']),
                float(row['lng']),
                pref,
            ))

    print(f'関東 {len(by_name)} 個のユニーク駅名（重複あり）を読み込み')
    print()
    print(f'{"slug":<18s} {"name":<10s} {"code":<10s} {"matches":<8s} 注釈')
    print('-' * 100)

    found = []
    missing = []
    for slug, name, note in DESTINATIONS:
        cands = by_name.get(name, [])
        if not cands:
            print(f'{slug:<18s} {name:<10s} {"MISSING":<10s} {0:<8d} {note}')
            missing.append((slug, name))
            continue
        # 複数候補時は最初の（恐らく最大規模駅）を採用
        cands.sort(key=lambda x: x[0])
        code, lat, lng, pref = cands[0]
        print(f'{slug:<18s} {name:<10s} {code:<10d} {len(cands):<8d} pref={pref}  {note}')
        found.append({
            'slug': slug, 'name': name, 'code': code,
            'lat': lat, 'lng': lng, 'pref': pref, 'note': note,
        })

    print()
    print(f'発見: {len(found)} / {len(DESTINATIONS)}')
    if missing:
        print('未発見:')
        for slug, name in missing:
            print(f'  - {slug} ({name})')

    # 出力: Python の DESTINATIONS dict コード生成
    print()
    print('=== build_stations_geojson_v3.py に挿入する DESTINATIONS ===')
    print('DESTINATIONS = [')
    for d in found:
        print(f"    ({d['code']:>8d}, {d['slug']!r:<18s}, {d['name']!r:<8s}),  # {d['note']}")
    print(']')

    return 0


if __name__ == '__main__':
    db = Path(sys.argv[1] if len(sys.argv) > 1 else '../station_database')
    sys.exit(main(db))
