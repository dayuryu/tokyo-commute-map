#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_stations_geojson_v3.py — 高精度版

精度改善のポイント：
  1. 平日サービスのみ（calendar.txt + calendar_dates.txt から判定）
  2. ラッシュアワー（7:00-9:30 に始発時刻のあるトリップのみ）
  3. 各エッジ上の全 route_id の時間を保持し、Dijkstra が動的に選択
     （v2 の「最速 route 採用」をやめる）
  4. 各 route の運行頻度から「初乗り待ち時間」「乗換待ち時間」を算出
     （v2 の固定 5 分罰時を可変化）
  5. クロスルート中央値（複数 route が同じエッジを共有する場合の現実的な所要時間）

使用方法:
  python build_stations_geojson_v3.py <station_database_dir> [gtfs_cache_dir]
"""

import sys, csv, json, math, zipfile, io, heapq, datetime
import urllib.request
from pathlib import Path
from collections import defaultdict
from typing import Optional

# ── 定数 ─────────────────────────────────────────────────────────────────────

GTFS_RELEASE = "20241214"
GTFS_BASE    = f"https://github.com/fksms/TrainGTFSGenerator/releases/download/{GTFS_RELEASE}"

GTFS_OPERATORS = [
    "JR-East-Train", "TokyoMetro-Train", "Toei-Train", "Tokyu-Train",
    "Odakyu-Train", "Keio-Train", "Seibu-Train", "Tobu-Train",
    "Keikyu-Train", "Keisei-Train", "Sotetsu-Train", "YokohamaMunicipal-Train",
    "MIR-Train", "Hokuso-Train", "Minatomirai-Train", "TWR-Train",
    "SR-Train", "TOYO-Train", "TamaMonorail-Train", "TokyoMonorail-Train",
    "ShinKeisei-Train", "Yurikamome-Train",
]

# ── 精度パラメータ ────────────────────────────────────────────────────────
TARGET_DATE       = datetime.date(2026, 5, 12)  # 火曜日（平日代表）
RUSH_START_MIN    = 7 * 60          # 07:00
RUSH_END_MIN      = 9 * 60 + 30     # 09:30
RUSH_WINDOW_HOURS = 2.5             # 7:00-9:30

TRANSFER_WALK_MIN = 2.0             # 乗換時の歩行時間（固定）
MIN_HEADWAY_MIN   = 1.0             # 半班距の下限
MAX_HEADWAY_MIN   = 15.0            # 半班距の上限（稀疏特急/特快のため拡大）

MATCH_RADIUS_KM   = 0.35
FALLBACK_SPEED_KMH = 40.0
FALLBACK_DETOUR    = 1.3
CUTOFF_MINUTES     = 120

KANTO_EXTENDED = {8, 9, 10, 11, 12, 13, 14, 19}
DESTINATIONS   = {"shinjuku": "新宿", "shibuya": "渋谷", "tokyo": "東京"}

# fallback の頻度（station_database 由来。GTFS データがないので保守的に推定）
FALLBACK_FREQ_PER_HOUR = 4.0  # 15分1本


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
    h, m, s = t.strip().split(":")
    return int(h) * 60 + int(m) + int(s) / 60.0


def read_zip_csv(zf, filename: str):
    with zf.open(filename) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


def headway_to_wait(trips_per_hour: float) -> float:
    """1時間あたりトリップ数 → 半班距（待ち時間期待値、分）"""
    if trips_per_hour <= 0:
        return MAX_HEADWAY_MIN
    half_headway = 30.0 / trips_per_hour  # 30 = 60 / 2
    return max(MIN_HEADWAY_MIN, min(MAX_HEADWAY_MIN, half_headway))


# ── STEP 1: 駅 DB ───────────────────────────────────────────────────────────

def load_stations(csv_path: Path) -> dict:
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
                lat = float(row["lat"])
                lng = float(row["lng"])
            except ValueError:
                continue
            stations[code] = {"name": row["name"], "lat": lat, "lng": lng}
    print(f"  駅DB: {len(stations)} 駅")
    return stations


class SpatialIndex:
    def __init__(self, stations: dict):
        self.stations = stations
        self.grid = defaultdict(list)
        for code, s in stations.items():
            gk = (int(s["lat"] * 10), int(s["lng"] * 10))
            self.grid[gk].append(code)

    def nearest(self, lat, lon, radius_km=MATCH_RADIUS_KM):
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


def download_gtfs(operator: str, cache_dir: Path):
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


# ── STEP 2: カレンダー解析（平日サービス特定） ──────────────────────────────

def get_active_services(zf, target_date: datetime.date) -> set:
    """
    target_date に運行する service_id 集合を返す。
    calendar.txt と calendar_dates.txt の両方を考慮。
    """
    weekday_idx = target_date.weekday()  # 月=0, 日=6
    weekday_cols = ["monday", "tuesday", "wednesday", "thursday", "friday",
                    "saturday", "sunday"]
    target_col = weekday_cols[weekday_idx]
    target_str = target_date.strftime("%Y%m%d")

    active = set()

    # calendar.txt
    try:
        for row in read_zip_csv(zf, "calendar.txt"):
            try:
                start = row.get("start_date", "").strip()
                end   = row.get("end_date", "").strip()
                if start and target_str < start:
                    continue
                if end and target_str > end:
                    continue
                if row.get(target_col, "0").strip() == "1":
                    active.add(row["service_id"])
            except (ValueError, KeyError):
                continue
    except KeyError:
        pass

    # calendar_dates.txt: 1=追加, 2=削除
    try:
        for row in read_zip_csv(zf, "calendar_dates.txt"):
            if row.get("date", "").strip() != target_str:
                continue
            sid = row.get("service_id", "").strip()
            etype = row.get("exception_type", "").strip()
            if etype == "1":
                active.add(sid)
            elif etype == "2":
                active.discard(sid)
    except KeyError:
        pass

    return active


# ── STEP 3: GTFS 解析（ラッシュアワー、平日のみ） ────────────────────────────

def parse_stops(zf):
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
        pass
    return stops


def resolve_stop_lat_lon(stop_id, stops):
    visited = set()
    cur = stop_id
    while cur in stops and stops[cur]["parent"] and cur not in visited:
        visited.add(cur)
        cur = stops[cur]["parent"]
    s = stops.get(cur, stops.get(stop_id, {}))
    return s.get("lat"), s.get("lon")


def parse_trips(zf):
    """{trip_id: (route_id, service_id)}"""
    out = {}
    try:
        for row in read_zip_csv(zf, "trips.txt"):
            out[row["trip_id"]] = (
                row.get("route_id", ""),
                row.get("service_id", ""),
            )
    except KeyError:
        pass
    return out


def parse_operator_data(zf, idx: SpatialIndex, operator_tag: str):
    """
    1運営者の GTFS から：
      edges_per_route : {route_id: {(ca, cb): [trip_times in rush hour]}}
      route_trip_count: {route_id: count of qualifying trips}
      edge_route_count: {(ca, cb): {route_id: trip_count_in_rush_hour}}
        ← v3.1 追加: エッジ専有頻度
    """
    active_services = get_active_services(zf, TARGET_DATE)
    has_calendar = bool(active_services)
    if not has_calendar:
        # calendar が無い運営者：全トリップ採用（後でラッシュアワー時刻でフィルタ）
        pass

    stops = parse_stops(zf)
    trip_meta = parse_trips(zf)  # {trip_id: (route_id, service_id)}

    # stop_id → 駅コード
    stop_to_code = {}
    for stop_id, s in stops.items():
        lat, lon = resolve_stop_lat_lon(stop_id, stops)
        if lat is None:
            continue
        code = idx.nearest(lat, lon)
        if code:
            stop_to_code[stop_id] = code

    # 平日サービスのトリップだけ処理
    qualifying_trips = set()
    for tid, (rid, sid) in trip_meta.items():
        if has_calendar and sid not in active_services:
            continue
        qualifying_trips.add(tid)

    # stop_times をストリーム読み込み
    trips = defaultdict(list)
    try:
        for row in read_zip_csv(zf, "stop_times.txt"):
            tid = row["trip_id"]
            if tid not in qualifying_trips:
                continue
            sid = row["stop_id"]
            if sid not in stop_to_code:
                continue
            try:
                arr = parse_gtfs_time(row["arrival_time"])
                dep = parse_gtfs_time(row["departure_time"])
                seq = int(row["stop_sequence"])
            except (ValueError, KeyError):
                continue
            trips[tid].append((seq, sid, arr, dep))
    except KeyError:
        pass

    edges_per_route = defaultdict(lambda: defaultdict(list))
    route_trip_count = defaultdict(int)
    edge_route_count = defaultdict(lambda: defaultdict(int))  # v3.1

    for tid, stop_list in trips.items():
        if not stop_list:
            continue
        rid = trip_meta.get(tid, ("", ""))[0]
        if not rid:
            continue
        rid_full = f"{operator_tag}::{rid}"
        stop_list.sort(key=lambda x: x[0])

        first_dep = stop_list[0][3]
        if first_dep >= 24 * 60:
            first_dep -= 24 * 60
        if not (RUSH_START_MIN <= first_dep <= RUSH_END_MIN):
            continue

        route_trip_count[rid_full] += 1

        for i in range(len(stop_list) - 1):
            _, sa, _,     dep_a = stop_list[i]
            _, sb, arr_b, _     = stop_list[i + 1]
            ca = stop_to_code.get(sa)
            cb = stop_to_code.get(sb)
            if not ca or not cb or ca == cb:
                continue
            t = arr_b - dep_a
            if 0 < t <= 90:
                key = (min(ca, cb), max(ca, cb))
                edges_per_route[rid_full][key].append(t)
                edge_route_count[key][rid_full] += 1  # v3.1

    return edges_per_route, route_trip_count, edge_route_count


def build_gtfs_data(gtfs_dir: Path, idx: SpatialIndex):
    """
    Returns:
      edge_routes           : {(ca, cb): {route_id: per_route_median_min}}
      route_freq            : {route_id: trips_per_hour}
      edge_route_freq       : {(ca, cb): {route_id: trips_per_hour}}
      edges_per_route_trips : {route_id: {(ca, cb): [trip_times]}}  ← cross-route pool 計算用
    """
    all_edge_routes = defaultdict(dict)
    all_route_freq  = {}
    all_edge_route_freq = defaultdict(dict)
    all_edges_per_route_trips = defaultdict(lambda: defaultdict(list))  # v3.2
    gtfs_dir.mkdir(parents=True, exist_ok=True)

    for op in GTFS_OPERATORS:
        print(f"  [{op}]", end="  ", flush=True)
        zf = download_gtfs(op, gtfs_dir)
        if zf is None:
            continue
        with zf:
            edges_per_route, trip_count, edge_route_count = parse_operator_data(zf, idx, op)

        edge_count_added = 0
        for rid, edges in edges_per_route.items():
            tcount = trip_count.get(rid, 0)
            tph = tcount / RUSH_WINDOW_HOURS if tcount > 0 else 0
            all_route_freq[rid] = tph
            for key, times in edges.items():
                # 全 trip 時間を保持
                all_edges_per_route_trips[rid][key].extend(times)
                # per-route median
                ts = sorted(times)
                median = ts[len(ts) // 2]
                all_edge_routes[key][rid] = median
                edge_count_added += 1
        for key, route_counts in edge_route_count.items():
            for rid, cnt in route_counts.items():
                all_edge_route_freq[key][rid] = cnt / RUSH_WINDOW_HOURS
        print(f"→ ルート {len(edges_per_route)}, エッジ寄与 {edge_count_added}")

    print(f"\n  ユニークエッジ数: {len(all_edge_routes)}")
    print(f"  ルート数: {len(all_route_freq)}")
    return all_edge_routes, all_route_freq, all_edge_route_freq, all_edges_per_route_trips


# ── STEP 4: フォールバック追加 ────────────────────────────────────────────

def add_fallback_edges(register_path: Path, stations: dict,
                       edge_routes: dict) -> int:
    """station_database から未カバー区間を距離推定で補う"""
    lines = defaultdict(list)
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
            if key in edge_routes:
                continue
            sa, sb = stations[ca], stations[cb]
            km = haversine_km(sa["lat"], sa["lng"], sb["lat"], sb["lng"])
            if km < 0.05 or km > 80:
                continue
            minutes = (km * FALLBACK_DETOUR / FALLBACK_SPEED_KMH) * 60
            edge_routes[key] = {f"FALLBACK::line_{lc}": minutes}
            added += 1
    return added


# ── STEP 5: 隣接リスト ────────────────────────────────────────────────────

def build_adjacency(edge_routes: dict, edge_route_freq: dict,
                    edges_per_route_trips: dict, stations: dict) -> dict:
    """
    {station: [(neighbor, edge_data), ...]}
    edge_data = {
      "routes": {route_id: travel_min},      # 各 route の所要時間
      "edge_freq_total": float,               # 全 route 合算 trips/hour
      "primary_route": str,                   # 最も貢献多い route
      "median_travel": float                  # クロスルート中央値（換乗時用）
    }

    edges_per_route_trips: {route_id: {edge: [trip_times]}}  ← クロスルート中央値計算用
    """
    # クロスルート中央値を事前計算
    pooled_times = defaultdict(list)
    for rid, edges in edges_per_route_trips.items():
        for key, times in edges.items():
            pooled_times[key].extend(times)

    edge_median_pooled = {}
    for key, times in pooled_times.items():
        if times:
            times.sort()
            edge_median_pooled[key] = times[len(times) // 2]

    adj = defaultdict(list)
    for (ca, cb), route_times in edge_routes.items():
        if ca not in stations or cb not in stations:
            continue
        edge_freq = edge_route_freq.get((ca, cb), {})
        total_freq = sum(edge_freq.values())
        # primary route = 最大頻度のもの
        primary = None
        if edge_freq:
            primary = max(edge_freq, key=edge_freq.get)
        else:
            primary = next(iter(route_times))
        median_travel = edge_median_pooled.get((ca, cb))
        if median_travel is None:
            # フォールバックエッジは route_times 内の値を使う
            median_travel = next(iter(route_times.values()))
        edge_data = {
            "routes": route_times,
            "edge_freq_total": total_freq,
            "primary_route": primary,
            "median_travel": median_travel,
        }
        adj[ca].append((cb, edge_data))
        adj[cb].append((ca, edge_data))
    return adj


# ── STEP 6: 高精度 Dijkstra ──────────────────────────────────────────────

def dijkstra_v3(adj: dict, source: int, cutoff: float = CUTOFF_MINUTES):
    """
    v3.2: edge_freq_total（全 route 合算）で待ち時間を算出。
    travel_time は cross-route pooled median を使う。
    primary_route で換乗判定。

    State: (mins, transfers, station, cur_route, last_edge_freq_total)
    """
    best = {}
    heap = [(0.0, 0, source, None, 0.0)]

    while heap:
        mins, xfers, station, cur_route, last_efreq = heapq.heappop(heap)
        key = (station, cur_route)
        if key in best:
            continue
        best[key] = (mins, xfers, last_efreq)

        if mins >= cutoff:
            continue

        for neighbor, edge_data in adj.get(station, []):
            travel = edge_data["median_travel"]
            edge_freq_total = edge_data["edge_freq_total"]
            primary = edge_data["primary_route"]
            routes = edge_data["routes"]

            # 同ルート維持できるか？ cur_route がこのエッジで使えれば yes
            can_stay = cur_route in routes

            if cur_route is None:
                # 始点：乗換ペナルティなし
                new_mins = mins + travel
                new_xfers = xfers
                new_route = primary
                new_efreq = edge_freq_total
            elif can_stay:
                # 同ルート維持
                new_mins = mins + travel
                new_xfers = xfers
                new_route = cur_route
                new_efreq = min(last_efreq, edge_freq_total) if edge_freq_total > 0 else last_efreq
            else:
                # 乗換が必要：合算頻度から待ち時間
                transfer_wait = headway_to_wait(edge_freq_total) if edge_freq_total > 0 else MAX_HEADWAY_MIN
                transfer_cost = TRANSFER_WALK_MIN + transfer_wait
                new_mins = mins + travel + transfer_cost
                new_xfers = xfers + 1
                new_route = primary
                new_efreq = edge_freq_total

            if new_mins <= cutoff:
                nkey = (neighbor, new_route)
                if nkey in best:
                    continue
                heapq.heappush(heap, (new_mins, new_xfers, neighbor, new_route, new_efreq))

    return best


def best_per_station(best_per_route: dict) -> dict:
    """
    v3.2: 初乗り待ち時間 = 経路上ボトルネック edge_freq_total
    """
    by_station = defaultdict(list)
    for (station, route), (mins, xfers, last_efreq) in best_per_route.items():
        if route is None:
            continue
        wait = headway_to_wait(last_efreq) if last_efreq > 0 else MAX_HEADWAY_MIN
        total = mins + wait
        by_station[station].append((total, xfers, route))

    result = {}
    for station, options in by_station.items():
        options.sort()
        result[station] = options[0]
    return result


# ── STEP 7: GeoJSON 出力 ─────────────────────────────────────────────────

def find_station_code(stations: dict, name: str):
    for code, info in stations.items():
        if info["name"] == name:
            return code
    for code, info in stations.items():
        if name in info["name"]:
            return code
    return None


def build_geojson(stations: dict, results: dict) -> dict:
    """
    results: {dest_key: {station: (total_mins, transfers, route)}}
    """
    features = []
    for code, info in stations.items():
        props = {"code": code, "name": info["name"]}
        has_any = False

        for dest_key, dest_result in results.items():
            if code in dest_result:
                mins, xfers, route = dest_result[code]
                props[f"min_to_{dest_key}"]       = int(round(mins))
                props[f"transfers_to_{dest_key}"] = xfers
                props[f"bucket_{dest_key}"]       = min(int(round(mins)) // 15, 5)
                has_any = True

        if not has_any:
            continue

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


# ── MAIN ──────────────────────────────────────────────────────────────────

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
    print("🚄  東京圏通勤マップ v3.0 — 高精度版")
    print(f"    対象日: {TARGET_DATE}（{['月','火','水','木','金','土','日'][TARGET_DATE.weekday()]}曜日）")
    print(f"    時間帯: {RUSH_START_MIN//60:02d}:{RUSH_START_MIN%60:02d}"
          f" - {RUSH_END_MIN//60:02d}:{RUSH_END_MIN%60:02d}")
    print("=" * 60)

    print("\n📂 Step 1: 駅 DB 読込")
    stations = load_stations(station_csv)
    idx = SpatialIndex(stations)

    print("\n🌐 Step 2: GTFS 解析（平日 + ラッシュアワー）")
    edge_routes, route_freq, edge_route_freq, edges_per_route_trips = build_gtfs_data(gtfs_cache, idx)

    print("\n🔧 Step 3: フォールバック補完")
    fb_added = add_fallback_edges(register_csv, stations, edge_routes)
    print(f"   フォールバックエッジ追加: {fb_added}")
    # フォールバックエッジに保守的な頻度を付与
    for k, rt in edge_routes.items():
        for r in rt:
            if r.startswith("FALLBACK::"):
                edge_route_freq.setdefault(k, {}).setdefault(r, FALLBACK_FREQ_PER_HOUR)
                # フォールバック用に edges_per_route_trips にも値を入れる（中央値 = travel time そのもの）
                if not edges_per_route_trips[r][k]:
                    edges_per_route_trips[r][k].append(edge_routes[k][r])

    print("\n📐 Step 4: 隣接グラフ構築")
    adj = build_adjacency(edge_routes, edge_route_freq, edges_per_route_trips, stations)
    print(f"   ノード数: {len(adj)}")

    print("\n⚙️  Step 5: 高精度 Dijkstra（エッジ別頻度感知）")
    results = {}
    for dest_key, dest_name in DESTINATIONS.items():
        src = find_station_code(stations, dest_name)
        if not src:
            print(f"  ❌ {dest_name} 見つからず")
            continue
        print(f"  → {dest_name} (code={src}) ...", end=" ", flush=True)
        best_pr = dijkstra_v3(adj, src)
        per_station = best_per_station(best_pr)
        results[dest_key] = per_station

        in_30 = sum(1 for m, _, _ in per_station.values() if m <= 30)
        in_60 = sum(1 for m, _, _ in per_station.values() if m <= 60)
        direct = sum(1 for m, t, _ in per_station.values() if t == 0 and m <= 60)
        print(f"{len(per_station)}駅到達  30分:{in_30}  60分:{in_60}  直通:{direct}")

    print("\n💾 Step 6: GeoJSON 生成")
    geojson = build_geojson(stations, results)
    out = Path("./stations.geojson")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  ✅ {len(geojson['features'])}駅 → {out}")

    print("\n📍 検証サンプル:")
    samples = ["池袋", "南浦和", "川崎", "武蔵小杉", "横浜", "吉祥寺",
               "三鷹", "立川", "千葉", "大宮", "上野", "北千住"]
    for feat in geojson["features"]:
        n = feat["properties"]["name"]
        if n in samples:
            p = feat["properties"]
            sj = p.get("min_to_shinjuku", "-")
            xj = p.get("transfers_to_shinjuku", "-")
            tk = p.get("min_to_tokyo", "-")
            print(f"   {n:<8s} → 新宿:{sj}分(乗{xj}回)  東京:{tk}分")


if __name__ == "__main__":
    main()
