"""
SUUMO 駅 deep link 用の (駅名 → ek_id, rn) マッピング作成スクリプト。

SUUMO の賃貸検索 URL は以下のフォーマット：
    https://suumo.jp/chintai/<pref>/ek_<5桁数字>/?rn=<沿線ID>

本スクリプトは関東 4 都県の各沿線ページをクロールし、
含まれる駅名 + ek_id + rn を抽出して JSON マッピングを出力する。

実行：
    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 \
      /c/Users/81704/AppData/Local/Programs/Python/Python312/python.exe \
      scripts/build_suumo_station_map.py

出力先：public/data/suumo_stations.json
"""

from __future__ import annotations
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# 関東 4 都県の沿線一覧ページ
PREFECTURES = [
    ('tokyo',    'https://suumo.jp/chintai/tokyo/ensen/'),
    ('kanagawa', 'https://suumo.jp/chintai/kanagawa/ensen/'),
    ('saitama',  'https://suumo.jp/chintai/saitama/ensen/'),
    ('chiba',    'https://suumo.jp/chintai/chiba/ensen/'),
]

USER_AGENT = 'Mozilla/5.0 (compatible; TokyoCommuteMapBot/1.0; affiliate-link-builder)'
REQUEST_SLEEP_SEC = 1.2  # SUUMO に優しく
TIMEOUT_SEC = 15
MAX_RETRY = 3

OUT_PATH = Path(__file__).parent.parent / 'public' / 'data' / 'suumo_stations.json'

# 沿線ページ URL から (?rn=NNNN) を抽出する用
RE_RN_FROM_URL = re.compile(r'/en_[^/]+/(?:\?[^"]*)?$')
# 沿線ページ内の駅ブロック抽出：
#   <a href="/chintai/<pref>/ek_<id>/?rn=<rn>">駅名</a>
# 駅名は anchor 内のテキスト（駅サフィックス無しの場合あり）
RE_STATION_LINK = re.compile(
    r'<a\s+href="(/chintai/[^/]+/ek_(\d+)/[^"]*?rn=(\d+)[^"]*)"[^>]*>([^<]+)</a>'
)
# 沿線一覧ページから en_* 沿線 URL を抽出
RE_LINE_URL = re.compile(r'href="(/chintai/[^/]+/en_[^/]+/)"')


def fetch(url: str) -> str:
    """SUUMO HTML を取得（リトライ・UA 付き）。"""
    last_err: Exception | None = None
    for attempt in range(MAX_RETRY):
        try:
            req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'ja'})
            with urlopen(req, timeout=TIMEOUT_SEC) as r:
                raw = r.read()
                return raw.decode('utf-8', errors='replace')
        except (HTTPError, URLError, TimeoutError) as e:
            last_err = e
            if attempt < MAX_RETRY - 1:
                time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f'fetch failed after {MAX_RETRY} retries: {url} ({last_err})')


def collect_line_urls(prefecture: str) -> list[str]:
    """都県の沿線一覧ページから en_<沿線> URL を抽出。"""
    ensen_url = f'https://suumo.jp/chintai/{prefecture}/ensen/'
    html = fetch(ensen_url)
    found: set[str] = set()
    for m in RE_LINE_URL.finditer(html):
        path = m.group(1)
        if f'/chintai/{prefecture}/' in path:
            found.add(urljoin('https://suumo.jp', path))
    return sorted(found)


def collect_stations_from_line(line_url: str) -> list[dict]:
    """沿線ページから (駅名, ek_id, rn) を抽出。"""
    html = fetch(line_url)
    pref_match = re.search(r'/chintai/([^/]+)/en_', line_url)
    pref = pref_match.group(1) if pref_match else ''

    seen: dict[tuple[str, str], dict] = {}
    for m in RE_STATION_LINK.finditer(html):
        full_path = m.group(1)
        ek_id     = m.group(2)
        rn        = m.group(3)
        name_raw  = m.group(4).strip()
        # 駅名から「駅」サフィックスを剥がす（後で station_database と突き合わせる用）
        name = name_raw.rstrip('駅').strip()
        if not name:
            continue
        key = (ek_id, rn)
        if key not in seen:
            seen[key] = {
                'name': name,
                'name_raw': name_raw,
                'ek_id': ek_id,
                'rn': rn,
                'pref': pref,
                'sample_url': urljoin('https://suumo.jp', full_path),
            }
    return list(seen.values())


def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    all_stations: dict[str, dict] = {}  # ek_id -> entry（重複統合）
    line_count = 0
    err_count = 0

    for pref, ensen_url in PREFECTURES:
        print(f'[{pref}] 沿線一覧を取得中… ({ensen_url})', flush=True)
        try:
            lines = collect_line_urls(pref)
        except Exception as e:
            print(f'  ERROR: {e}', flush=True)
            err_count += 1
            continue
        print(f'  {len(lines)} 沿線を発見', flush=True)
        time.sleep(REQUEST_SLEEP_SEC)

        for i, line_url in enumerate(lines, 1):
            try:
                stations = collect_stations_from_line(line_url)
            except Exception as e:
                print(f'  [{i}/{len(lines)}] FAIL: {line_url} ({e})', flush=True)
                err_count += 1
                time.sleep(REQUEST_SLEEP_SEC)
                continue

            added = 0
            for s in stations:
                key = s['ek_id']
                if key not in all_stations:
                    all_stations[key] = s
                    added += 1
            line_count += 1
            print(f'  [{i}/{len(lines)}] {line_url.rsplit("/en_", 1)[-1].rstrip("/")} → {len(stations)} 駅 (新規 {added})', flush=True)
            time.sleep(REQUEST_SLEEP_SEC)

    out = sorted(all_stations.values(), key=lambda s: (s['pref'], s['ek_id']))
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

    print('', flush=True)
    print(f'完了: {line_count} 沿線, {len(out)} 駅 (エラー {err_count})', flush=True)
    print(f'出力: {OUT_PATH}', flush=True)

    # サンプル: 主要駅の URL を表示
    samples = ['新宿', '渋谷', '東京', '武蔵小杉', '北千住', '吉祥寺', '池袋', '横浜']
    print('', flush=True)
    print('— サンプル駅検証 —', flush=True)
    for target in samples:
        match = next((s for s in out if s['name'] == target), None)
        if match:
            print(f'  ✓ {target} → ek_{match["ek_id"]} (pref={match["pref"]}, rn={match["rn"]})', flush=True)
        else:
            print(f'  ✗ {target} 未検出', flush=True)

    return 0 if err_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
