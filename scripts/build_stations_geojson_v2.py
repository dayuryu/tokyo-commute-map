#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_stations_geojson_v2.py

Sprint 1 v2: GTFS完全対応版
- データソース: TrainGTFSGenerator (22社, JR東日本含む)
  https://github.com/fksms/TrainGTFSGenerator/releases/tag/20241214
- JR未カバー区間: station_database の距離推定で補完
- 出力: stations.geojson (真実の通勤時間 + 乗換回数)

使用方法:
  python build_stations_geojson_v2.py <station_database_dir> [gtfs_cache_dir]
  例: python build_stations_geojson_v2.py ../../station_database ./gtfs_cache
"""

import sys, csv, json, math, zipfile, io, heapq
import urllib.request
from pathlib import Path
from collections import defaultdict

# ── 定数 ─────────────────────────────────────────────────────────────────────

GTFS_RELEASE = "20241214"
GTFS_BASE    = f"https://github.com/fksms/TrainGTFSGenerator/releases/download/{GTFS_RELEASE}"

GTFS_OPERATORS = [
    "JR-East-Train",
    "TokyoMetro-Train",
    "Toei-Train",
    "Tokyu-Train",
    "Odakyu-Train",
    "Keio-Train",
    "Seibu-Train",
    "Tobu-Train",
    "Keikyu-Train",
    "Keisei-Train",
    "Sotetsu-Train",
    "YokohamaMunicipal-Train",
    "MIR-Train",          # つくばエクスプレス
    "Hokuso-Train",
    "Minatomirai-Train",
    "TWR-Train",          # 東京臨海高速鉄道 (りんかい線)
    "SR-Train",           # 埼玉高速鉄道
    "TOYO-Train",         # 東葉高速鉄道
    "TamaMonorail-Train",
    "TokyoMonorail-Train",
    "ShinKeisei-Train",
    "Yurikamome-Train",
]

TRANSFER_PENALTY_MIN = 5    # 時間（分）
MATCH_RADIUS_KM      = 0.35 # GTFSストップ→駅コード マッチ半径（km）
FALLBACK_SPEED_KMH   = 40.0 # フォールバック用平均速度
FALLBACK_DETOUR      = 1.3  # 迂回係数
CUTOFF_MINUTES       = 120  # Dijkstra打ち切り（分）

KANTO_EXTENDED = {8, 9, 10, 11, 12, 13, 14, 19}
DESTINATIONS   = {"shinjuku": "新宿", "shibuya": "渋谷", "tokyo": "東京"}


# ── ユーティリティ ─────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def parse_gtfs_time(t: str) -> float:
    """HH:MM:SS → 分 (HH>23 も対応)"""
    h, m, s = t.strip().split(":")
    return int(h) * 60 + int(m) + int(s) / 60.0


def read_zip_csv(zf: zipfile.ZipFile, filename: str):
    """ZIPファイル内のCSVを DictReader で返す"""
    with zf.open(filename) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


# ── STEP 1: station_database 読み込み ─────────────────────────────────────────

def load_stations(csv_path: Path) -> dict:
    """
    関東圏の駅のみ読み込む
    Returns: {code(int): {"name": str, "lat": float, "lng": float}}
    """
    stations = {}
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["closed"].strip() == "true":
                continue
            try:
                pref = int(row["prefecture"])
            except ValueError:
                continue
            if pref not in KANTO_EXTENDED:
                continue
            try:
                code = int(row["code"])
                lat  = float(row["lat"])
                lng  = float(row["lng"])
            except ValueError:
                continue
            stations[code] = {"name": row["name"], "lat": lat, "lng": lng}

    print(f"  駅DB: {len(stations)} 駅 読み込み")
    return stations


# ── STEP 2: 空間インデックス ──────────────────────────────────────────────────

class SpatialIndex:
    """
    緯度経度グリッドによる高速近傍探索
    グリッドサイズ = 0.1度 ≈ 約10km
    """
    def __init__(self, stations: dict):
        self.stations = stations
        self.grid = defaultdict(list)
        for code, s in stations.items():
            gk = (int(s["lat"] * 10), int(s["lng"] * 10))
            self.grid[gk].append(code)

    def nearest(self, lat: float, lon: float, radius_km: float = MATCH_RADIUS_KM):
        """半径 radius_km 以内の最近傍駅コードを返す（なければ None）"""
        gi, gj = int(lat * 10), int(lon * 10)
        best_code = None
        best_dist = radius_km
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for code in self.grid.get((gi + di, gj + dj), []):
                    s = self.stations[code]
                    d = haversine_km(lat, lon, s["lat"], s["lng"])
                    if d < best_dist:
                        best_dist = d
                        best_code = code
        return best_code


# ── STEP 3: GTFS 解析 ─────────────────────────────────────────────────────────

def download_gtfs(operator: str, cache_dir: Path) -> zipfile.ZipFile | None:
    """GTFSをダウンロード（キャッシュあり）してZipFileを返す"""
    path = cache_dir / f"{operator}.gtfs.zip"
    if not path.exists():
        url = f"{GTFS_BASE}/{operator}.gtfs.zip"
        print(f"    ↓ {operator} ...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(url, path)
            print(f"{path.stat().st_size // 1024} KB")
        except Exception as e:
            print(f"失敗: {e}")
            return None
    return zipfile.ZipFile(path)


def parse_stops(zf: zipfile.ZipFile) -> dict:
    """
    stops.txt → {stop_id: {"lat", "lon", "parent"}}
    parent が存在する場合はそちらの座標を優先する
    """
    stops = {}
    try:
        for row in read_zip_csv(zf, "stops.txt"):
            try:
                stops[row["stop_id"]] = {
                    "lat":    float(row["stop_lat"]),
                    "lon":    float(row["stop_lon"]),
                    "parent": row.get("parent_station", "").strip(),
                }
            except (ValueError, KeyError):
                continue
    except KeyError:
        pass  # stops.txt が存在しない場合
    return stops


def resolve_stop_lat_lon(stop_id: str, stops: dict):
    """parent_station を辿って最上位の座標を返す"""
    visited = set()
    cur = stop_id
    while cur in stops and stops[cur]["parent"] and cur not in visited:
        visited.add(cur)
        cur = stops[cur]["parent"]
    s = stops.get(cur, stops.get(stop_id, {}))
    return s.get("lat"), s.get("lon")


def parse_trips(zf: zipfile.ZipFile) -> dict:
    """trips.txt → {trip_id: route_id}"""
    trip_to_route = {}
    try:
        for row in read_zip_csv(zf, "trips.txt"):
            trip_to_route[row["trip_id"]] = row["route_id"]
    except KeyError:
        pass
    return trip_to_route


def parse_gtfs_edges(zf: zipfile.ZipFile, idx: SpatialIndex) -> dict:
    """
    GTFSファイル1つを解析して駅コード間の辺を返す

    Returns:
        {(code_a, code_b): {"min": float, "route": str}}
        code_a < code_b を保証
    """
    stops      = parse_stops(zf)
    trip_route = parse_trips(zf)

    # stop_id → 駅コード マッピング（座標ベース）
    stop_to_code: dict[str, int] = {}
    for stop_id, s in stops.items():
        lat, lon = resolve_stop_lat_lon(stop_id, stops)
        if lat is None:
            continue
        code = idx.nearest(lat, lon)
        if code:
            stop_to_code[stop_id] = code

    # stop_times.txt を trip 単位でストリーム処理
    # trip_id → [(stop_sequence, stop_id, arrival_min, departure_min)]
    trips: dict[str, list] = defaultdict(list)

    try:
        for row in read_zip_csv(zf, "stop_times.txt"):
            sid = row["stop_id"]
            if sid not in stop_to_code:
                continue
            try:
                arr = parse_gtfs_time(row["arrival_time"])
                dep = parse_gtfs_time(row["departure_time"])
                seq = int(row["stop_sequence"])
            except (ValueError, KeyError):
                continue
            trips[row["trip_id"]].append((seq, sid, arr, dep))
    except KeyError:
        pass

    # route_id × (code_a, code_b) → [travel_times]
    route_edge_times: dict[str, dict[tuple, list]] = defaultdict(lambda: defaultdict(list))

    for trip_id, stop_list in trips.items():
        route_id = trip_route.get(trip_id, trip_id)
        stop_list.sort(key=lambda x: x[0])
        for i in range(len(stop_list) - 1):
            _, sa, _,     dep_a = stop_list[i]
            _, sb, arr_b, _     = stop_list[i + 1]
            ca = stop_to_code.get(sa)
            cb = stop_to_code.get(sb)
            if not ca or not cb or ca == cb:
                continue
            t = arr_b - dep_a
            if 0 < t <= 90:  # 0〜90分の合理的な範囲
                key = (min(ca, cb), max(ca, cb))
                route_edge_times[route_id][key].append(t)

    # route_id × edge → 中央値 → 最速routeを採用
    edges: dict[tuple, dict] = {}
    for route_id, re in route_edge_times.items():
        for key, times in re.items():
            times.sort()
            median = times[len(times) // 2]
            if key not in edges or edges[key]["min"] > median:
                edges[key] = {"min": median, "route": route_id}

    return edges


# ── STEP 4: 全GTFSを処理してマージ ───────────────────────────────────────────

def build_gtfs_edges(gtfs_dir: Path, idx: SpatialIndex) -> dict:
    """
    全GTFSオペレーターを処理して統合辺リストを返す
    同一辺は最短時間を採用
    """
    all_edges: dict[tuple, dict] = {}
    gtfs_dir.mkdir(parents=True, exist_ok=True)

    for op in GTFS_OPERATORS:
        print(f"  [{op}]", end="  ")
        zf = download_gtfs(op, gtfs_dir)
        if zf is None:
            continue
        with zf:
            edges = parse_gtfs_edges(zf, idx)
        added = updated = 0
        for key, info in edges.items():
            if key not in all_edges:
                all_edges[key] = info
                added += 1
            elif all_edges[key]["min"] > info["min"]:
                all_edges[key] = info
                updated += 1
        print(f"→ 新規 {added}  更新 {updated}")

    gtfs_count = len(all_edges)
    print(f"\n  GTFS辺合計: {gtfs_count}")
    return all_edges


# ── STEP 5: 未カバー区間をフォールバックで補完 ───────────────────────────────

def add_fallback_edges(register_path: Path, stations: dict, edges: dict) -> int:
    """
    station_database の register.csv を使って GTFS 未カバー辺を追加
    距離推定（迂回係数込み）でフォールバック
    """
    lines: dict[int, list] = defaultdict(list)
    with open(register_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sc = int(row["station_code"])
            lc = int(row["line_code"])
            ix = int(row["index"])
            if sc in stations:
                lines[lc].append((ix, sc))

    added = 0
    for lc, stops in lines.items():
        stops.sort()
        for i in range(len(stops) - 1):
            _, ca = stops[i]
            _, cb = stops[i + 1]
            if ca not in stations or cb not in stations:
                continue
            key = (min(ca, cb), max(ca, cb))
            if key in edges:
                continue  # GTFSがあればスキップ
            sa, sb = stations[ca], stations[cb]
            km = haversine_km(sa["lat"], sa["lng"], sb["lat"], sb["lng"])
            if km < 0.05 or km > 80:
                continue
            minutes = (km * FALLBACK_DETOUR / FALLBACK_SPEED_KMH) * 60
            edges[key] = {"min": minutes, "route": f"fallback_{lc}"}
            added += 1

    return added


# ── STEP 6: 隣接リスト構築 ────────────────────────────────────────────────────

def build_adjacency(edges: dict, stations: dict) -> dict:
    """
    {station_code: [(neighbor_code, minutes, route_id), ...]}
    """
    adj: dict[int, list] = defaultdict(list)
    for (ca, cb), info in edges.items():
        if ca in stations and cb in stations:
            adj[ca].append((cb, info["min"], info["route"]))
            adj[cb].append((ca, info["min"], info["route"]))
    return adj


# ── STEP 7: 乗換認識 Dijkstra ────────────────────────────────────────────────

def dijkstra_with_transfers(adj: dict, source: int,
                             cutoff: float = CUTOFF_MINUTES) -> dict:
    """
    乗換を考慮した最短経路（Dijkstra）

    State: (total_minutes, transfer_count, station_code, current_route_id)
    乗換 = route_id が変わるとき → TRANSFER_PENALTY_MIN 加算

    Returns:
        {station_code: (total_minutes, transfer_count)}
    """
    best: dict[int, tuple] = {}
    # heap: (minutes, transfers, station, cur_route)
    heap = [(0.0, 0, source, None)]

    while heap:
        mins, transfers, station, cur_route = heapq.heappop(heap)

        if station in best:
            continue
        best[station] = (mins, transfers)

        if mins >= cutoff:
            continue

        for neighbor, edge_min, route in adj.get(station, []):
            if neighbor in best:
                continue
            is_transfer = cur_route is not None and route != cur_route
            penalty     = TRANSFER_PENALTY_MIN if is_transfer else 0
            new_mins    = mins + edge_min + penalty
            new_xfers   = transfers + (1 if is_transfer else 0)
            if new_mins <= cutoff:
                heapq.heappush(heap, (new_mins, new_xfers, neighbor, route))

    return best


# ── STEP 8: 目的地駅コード検索 ───────────────────────────────────────────────

def find_station_code(stations: dict, name: str) -> int | None:
    for code, info in stations.items():
        if info["name"] == name:
            return code
    for code, info in stations.items():
        if name in info["name"]:
            return code
    return None


# ── STEP 9: GeoJSON 出力 ──────────────────────────────────────────────────────

def build_geojson(stations: dict, results: dict) -> dict:
    """
    results: {"shinjuku": {code: (mins, transfers)}, ...}

    各 Feature に追加されるプロパティ:
      min_to_{dest}       : int  通勤時間（分）
      transfers_to_{dest} : int  乗換回数
      bucket_{dest}       : int  色阶 (0=<15分 … 5=75分+)
      bucket              : int  新宿基準のデフォルト色阶
    """
    features = []
    for code, info in stations.items():
        props: dict = {"code": code, "name": info["name"]}
        has_any = False

        for dest_key, dest_result in results.items():
            if code in dest_result:
                mins, xfers = dest_result[code]
                props[f"min_to_{dest_key}"]       = int(mins)
                props[f"transfers_to_{dest_key}"] = xfers
                props[f"bucket_{dest_key}"]        = min(int(mins) // 15, 5)
                has_any = True

        if not has_any:
            continue

        # デフォルト bucket（新宿 → 渋谷 → 東京の優先順）
        if "bucket_shinjuku" in props:
            props["bucket"] = props["bucket_shinjuku"]
        elif "bucket_shibuya" in props:
            props["bucket"] = props["bucket_shibuya"]
        else:
            props["bucket"] = props.get("bucket_tokyo", 5)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [info["lng"], info["lat"]],
            },
            "properties": props,
        })

    return {"type": "FeatureCollection", "features": features}


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        db_dir = Path("./station_database/out/main")
        if not db_dir.exists():
            db_dir = Path("./out/main")
    else:
        db_dir = Path(sys.argv[1]) / "out" / "main"
        if not db_dir.exists():
            db_dir = Path(sys.argv[1])

    gtfs_cache = Path(sys.argv[2]) if len(sys.argv) >= 3 else Path("./gtfs_cache")

    station_csv  = db_dir / "station.csv"
    register_csv = db_dir / "register.csv"

    for p in (station_csv, register_csv):
        if not p.exists():
            print(f"❌ ファイルが見つかりません: {p}")
            sys.exit(1)

    print("=" * 60)
    print("🚄  東京圏通勤マップ v2.0 — GTFS完全対応")
    print("=" * 60)

    # ── 1. 駅DB ──────────────────────────────────────────────────
    print("\n📂 Step 1: 駅データベース読み込み...")
    stations = load_stations(station_csv)
    idx = SpatialIndex(stations)

    # ── 2. GTFS ──────────────────────────────────────────────────
    print("\n🌐 Step 2: GTFSデータ取得・解析...")
    print(f"   キャッシュ先: {gtfs_cache.resolve()}")
    edges = build_gtfs_edges(gtfs_cache, idx)

    # ── 3. フォールバック ─────────────────────────────────────────
    print("\n🔧 Step 3: フォールバック辺（JR補完）追加...")
    fb_added = add_fallback_edges(register_csv, stations, edges)
    gtfs_cnt     = sum(1 for e in edges.values() if not e["route"].startswith("fallback_"))
    fallback_cnt = len(edges) - gtfs_cnt
    print(f"   GTFS由来: {gtfs_cnt}辺   フォールバック: {fallback_cnt}辺 (+{fb_added}辺追加)")

    # ── 4. グラフ構築 ─────────────────────────────────────────────
    print("\n📐 Step 4: 隣接グラフ構築...")
    adj = build_adjacency(edges, stations)
    print(f"   ノード数: {len(adj)}  総辺数: {len(edges)}")

    # ── 5. Dijkstra ──────────────────────────────────────────────
    print("\n⚙️  Step 5: 通勤時間計算（乗換認識Dijkstra）...")
    results: dict[str, dict] = {}
    for dest_key, dest_name in DESTINATIONS.items():
        src = find_station_code(stations, dest_name)
        if not src:
            print(f"  ❌ {dest_name} が見つかりません")
            continue
        print(f"  → {dest_name} (code={src}) ... ", end="", flush=True)
        r = dijkstra_with_transfers(adj, src)
        results[dest_key] = r

        in_30   = sum(1 for m, _ in r.values() if m <= 30)
        in_60   = sum(1 for m, _ in r.values() if m <= 60)
        direct  = sum(1 for m, t in r.values() if t == 0 and m <= 60)
        print(f"{len(r)}駅到達  30分:{in_30}  60分:{in_60}  直通:{direct}")

    # ── 6. GeoJSON 生成 ───────────────────────────────────────────
    print("\n💾 Step 6: GeoJSON生成...")
    geojson = build_geojson(stations, results)
    total   = len(geojson["features"])

    out = Path("./stations.geojson")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = out.stat().st_size // 1024
    print(f"  ✅ {total}駅  {size_kb} KB → {out}")

    # ── 検証サンプル ──────────────────────────────────────────────
    print("\n📍 検証サンプル（→新宿）:")
    samples = {"南浦和", "武蔵小杉", "吉祥寺", "横浜", "大宮", "千葉",
               "池袋", "渋谷", "川崎", "浦和", "赤羽"}
    for feat in geojson["features"]:
        n = feat["properties"]["name"]
        if n in samples:
            p    = feat["properties"]
            mins = p.get("min_to_shinjuku", "N/A")
            xfer = p.get("transfers_to_shinjuku", "?")
            src  = "GTFS" if p.get("min_to_shinjuku") else "  —  "
            print(f"   {n:8s}  {str(mins):>4}分  乗換{xfer}回")


if __name__ == "__main__":
    main()
