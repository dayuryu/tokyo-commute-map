#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
diagnose_data_sources.py

诊断脚本（不修改 v2，不动 public/data/stations.geojson）

功能：
  1. 复用 v2 的 GTFS 解析 + fallback 补完逻辑
  2. 改造 Dijkstra 记录每条最短路径上的：边来源(GTFS/fallback)、route_id、各部分耗时
  3. 输出 coverage_report.json 与人类可读摘要

输出文件：
  ./diagnose_output/coverage_report.json     完整诊断数据
  ./diagnose_output/summary.txt              人类可读摘要
  ./diagnose_output/per_operator.json        各运营商边数贡献
  ./diagnose_output/worst_fallback_paths.json fallback 占比最高的路径

使用方法:
  python diagnose_data_sources.py <station_database_dir> [gtfs_cache_dir]
"""

import sys, csv, json, math, zipfile, io, heapq
import urllib.request
from pathlib import Path
from collections import defaultdict

# ── v2 と同じ定数 ────────────────────────────────────────────────────────────

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
    "MIR-Train",
    "Hokuso-Train",
    "Minatomirai-Train",
    "TWR-Train",
    "SR-Train",
    "TOYO-Train",
    "TamaMonorail-Train",
    "TokyoMonorail-Train",
    "ShinKeisei-Train",
    "Yurikamome-Train",
]

TRANSFER_PENALTY_MIN = 5
MATCH_RADIUS_KM      = 0.35
FALLBACK_SPEED_KMH   = 40.0
FALLBACK_DETOUR      = 1.3
CUTOFF_MINUTES       = 120

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
    h, m, s = t.strip().split(":")
    return int(h) * 60 + int(m) + int(s) / 60.0


def read_zip_csv(zf, filename: str):
    with zf.open(filename) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


# ── データ読み込み（v2 と同等） ─────────────────────────────────────────────

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
                lat  = float(row["lat"])
                lng  = float(row["lng"])
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
    trip_to_route = {}
    try:
        for row in read_zip_csv(zf, "trips.txt"):
            trip_to_route[row["trip_id"]] = row["route_id"]
    except KeyError:
        pass
    return trip_to_route


def parse_gtfs_edges(zf, idx, operator_tag: str) -> dict:
    """
    与 v2 一致地解析边，但额外把运营商标签也带上（用于诊断）
    Returns: {(code_a, code_b): {"min": float, "route": str, "operator": str}}
    """
    stops      = parse_stops(zf)
    trip_route = parse_trips(zf)

    stop_to_code = {}
    for stop_id, s in stops.items():
        lat, lon = resolve_stop_lat_lon(stop_id, stops)
        if lat is None:
            continue
        code = idx.nearest(lat, lon)
        if code:
            stop_to_code[stop_id] = code

    trips = defaultdict(list)
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

    route_edge_times = defaultdict(lambda: defaultdict(list))
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
            if 0 < t <= 90:
                key = (min(ca, cb), max(ca, cb))
                route_edge_times[route_id][key].append(t)

    edges = {}
    for route_id, re in route_edge_times.items():
        for key, times in re.items():
            times.sort()
            median = times[len(times) // 2]
            if key not in edges or edges[key]["min"] > median:
                edges[key] = {"min": median, "route": route_id, "operator": operator_tag}
    return edges


def build_gtfs_edges(gtfs_dir: Path, idx) -> tuple[dict, dict]:
    """
    Returns: (all_edges, per_operator_stats)
    per_operator_stats: {op: {"new": int, "updated": int, "edge_keys": set}}
    """
    all_edges = {}
    per_op_stats = {}
    gtfs_dir.mkdir(parents=True, exist_ok=True)

    for op in GTFS_OPERATORS:
        print(f"  [{op}]", end="  ")
        zf = download_gtfs(op, gtfs_dir)
        if zf is None:
            per_op_stats[op] = {"new": 0, "updated": 0, "edge_keys": []}
            continue
        with zf:
            edges = parse_gtfs_edges(zf, idx, op)
        added = updated = 0
        owned_keys = []
        for key, info in edges.items():
            if key not in all_edges:
                all_edges[key] = info
                added += 1
                owned_keys.append(key)
            elif all_edges[key]["min"] > info["min"]:
                all_edges[key] = info
                updated += 1
                owned_keys.append(key)
        per_op_stats[op] = {"new": added, "updated": updated, "edge_keys": owned_keys}
        print(f"→ 新規 {added}  更新 {updated}")

    print(f"\n  GTFS辺合計: {len(all_edges)}")
    return all_edges, per_op_stats


def add_fallback_edges(register_path: Path, stations: dict, edges: dict) -> int:
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
            if key in edges:
                continue
            sa, sb = stations[ca], stations[cb]
            km = haversine_km(sa["lat"], sa["lng"], sb["lat"], sb["lng"])
            if km < 0.05 or km > 80:
                continue
            minutes = (km * FALLBACK_DETOUR / FALLBACK_SPEED_KMH) * 60
            edges[key] = {
                "min": minutes,
                "route": f"fallback_{lc}",
                "operator": "FALLBACK",
                "fallback_km": km,
            }
            added += 1
    return added


def build_adjacency(edges: dict, stations: dict) -> dict:
    """{station: [(neighbor, minutes, route, operator, fallback_km_or_None), ...]}"""
    adj = defaultdict(list)
    for (ca, cb), info in edges.items():
        if ca in stations and cb in stations:
            entry = (info["min"], info["route"], info.get("operator", "?"), info.get("fallback_km"))
            adj[ca].append((cb, *entry))
            adj[cb].append((ca, *entry))
    return adj


# ── 改造 Dijkstra：记录前驱 + 边来源 ─────────────────────────────────────────

def dijkstra_with_path(adj: dict, source: int, cutoff: float = CUTOFF_MINUTES):
    """
    Returns:
      best: {station: (mins, transfers)}
      pred: {station: (prev_station, edge_min, route, operator, fallback_km, transfer_penalty)}
    """
    best = {}
    pred = {source: None}
    # heap: (mins, transfers, station, cur_route, prev_station, edge_min, route, operator, fb_km, penalty)
    heap = [(0.0, 0, source, None, None, 0.0, None, None, None, 0.0)]

    while heap:
        mins, xfers, station, cur_route, prev, e_min, e_route, e_op, e_fbkm, penalty = heapq.heappop(heap)

        if station in best:
            continue
        best[station] = (mins, xfers)
        if station != source:
            pred[station] = (prev, e_min, e_route, e_op, e_fbkm, penalty)

        if mins >= cutoff:
            continue

        for neighbor, edge_min, route, operator, fb_km in adj.get(station, []):
            if neighbor in best:
                continue
            is_transfer = cur_route is not None and route != cur_route
            p           = TRANSFER_PENALTY_MIN if is_transfer else 0
            new_mins    = mins + edge_min + p
            new_xfers   = xfers + (1 if is_transfer else 0)
            if new_mins <= cutoff:
                heapq.heappush(heap, (new_mins, new_xfers, neighbor, route,
                                       station, edge_min, route, operator, fb_km, p))
    return best, pred


def reconstruct_path(pred: dict, target: int) -> list:
    """从 pred 链回溯，返回 [(station, edge_min, route, operator, fb_km, penalty), ...]
       第一个元素是 source（penalty/edge 都为 None/0）"""
    path = []
    cur = target
    while cur is not None and cur in pred:
        if pred[cur] is None:
            path.append((cur, None, None, None, None, None))
            break
        prev, e_min, route, op, fb_km, penalty = pred[cur]
        path.append((cur, e_min, route, op, fb_km, penalty))
        cur = prev
    path.reverse()
    return path


def find_station_code(stations: dict, name: str):
    for code, info in stations.items():
        if info["name"] == name:
            return code
    for code, info in stations.items():
        if name in info["name"]:
            return code
    return None


# ── 诊断主逻辑 ────────────────────────────────────────────────────────────────

def analyze_path(path: list) -> dict:
    """统计一条路径上的边来源"""
    n_gtfs = n_fb = 0
    min_gtfs = min_fb = min_xfer = 0.0
    routes = []
    fb_km_total = 0.0
    for code, e_min, route, op, fb_km, penalty in path:
        if route is None:
            continue  # source 节点
        if route.startswith("fallback_"):
            n_fb += 1
            min_fb += e_min
            if fb_km:
                fb_km_total += fb_km
        else:
            n_gtfs += 1
            min_gtfs += e_min
        if penalty:
            min_xfer += penalty
        routes.append({"route": route, "op": op, "min": round(e_min, 1),
                       "is_fallback": route.startswith("fallback_")})
    return {
        "n_edges_gtfs":   n_gtfs,
        "n_edges_fb":     n_fb,
        "min_from_gtfs":  round(min_gtfs, 1),
        "min_from_fb":    round(min_fb, 1),
        "min_from_xfer":  round(min_xfer, 1),
        "fb_km_total":    round(fb_km_total, 2),
        "fb_share":       round(n_fb / max(n_gtfs + n_fb, 1), 3),
        "routes":         routes,
    }


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

    out_dir = Path("./diagnose_output")
    out_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("🔬  データソース診断")
    print("=" * 60)

    print("\n📂 駅データベース読み込み...")
    stations = load_stations(station_csv)
    idx = SpatialIndex(stations)

    print("\n🌐 GTFS解析...")
    edges, per_op_stats = build_gtfs_edges(gtfs_cache, idx)

    print("\n🔧 フォールバック追加...")
    fb_added = add_fallback_edges(register_csv, stations, edges)
    gtfs_cnt     = sum(1 for e in edges.values() if not e["route"].startswith("fallback_"))
    fallback_cnt = len(edges) - gtfs_cnt
    print(f"   GTFS辺: {gtfs_cnt}  フォールバック辺: {fallback_cnt}")

    adj = build_adjacency(edges, stations)
    print(f"   ノード: {len(adj)}  総辺: {len(edges)}")

    print("\n⚙️  Dijkstra（経路追跡付き）...")
    coverage = {"destinations": {}, "stations": stations}
    for dest_key, dest_name in DESTINATIONS.items():
        src = find_station_code(stations, dest_name)
        if not src:
            continue
        print(f"  → {dest_name} (code={src}) ...", end=" ", flush=True)
        best, pred = dijkstra_with_path(adj, src)
        per_station = {}
        for code, (mins, xfers) in best.items():
            if code == src:
                continue
            path = reconstruct_path(pred, code)
            stats = analyze_path(path)
            per_station[code] = {
                "name": stations[code]["name"],
                "mins": int(mins),
                "transfers": xfers,
                **stats,
            }
        coverage["destinations"][dest_key] = {
            "dest_name": dest_name,
            "dest_code": src,
            "stations": per_station,
        }
        print(f"{len(per_station)} 駅到達")

    # ── 出力 ──────────────────────────────────────────────────────────────
    print("\n💾 レポート出力...")

    # 1) 完整诊断 JSON（精简版，去掉 routes 详情避免爆炸）
    coverage_lite = {"destinations": {}}
    coverage_full = {"destinations": {}}
    for dest_key, d in coverage["destinations"].items():
        lite = {}
        full = {}
        for code, info in d["stations"].items():
            lite[code] = {
                "name":          info["name"],
                "mins":          info["mins"],
                "transfers":     info["transfers"],
                "n_edges_gtfs":  info["n_edges_gtfs"],
                "n_edges_fb":    info["n_edges_fb"],
                "min_from_gtfs": info["min_from_gtfs"],
                "min_from_fb":   info["min_from_fb"],
                "min_from_xfer": info["min_from_xfer"],
                "fb_share":      info["fb_share"],
            }
            full[code] = info
        coverage_lite["destinations"][dest_key] = {"dest_name": d["dest_name"], "stations": lite}
        coverage_full["destinations"][dest_key] = {"dest_name": d["dest_name"], "stations": full}

    with open(out_dir / "coverage_report.json", "w", encoding="utf-8") as f:
        json.dump(coverage_lite, f, ensure_ascii=False, separators=(",", ":"))
    with open(out_dir / "coverage_full.json", "w", encoding="utf-8") as f:
        json.dump(coverage_full, f, ensure_ascii=False, separators=(",", ":"))

    # 2) 各运营商贡献
    op_summary = {op: {"edges_owned": len(s["edge_keys"])}
                  for op, s in per_op_stats.items()}
    with open(out_dir / "per_operator.json", "w", encoding="utf-8") as f:
        json.dump(op_summary, f, ensure_ascii=False, indent=2)

    # 3) fallback 占比最高的 worst paths
    worst = []
    for dest_key, d in coverage_full["destinations"].items():
        for code, info in d["stations"].items():
            if info["n_edges_gtfs"] + info["n_edges_fb"] >= 2:  # 多于 1 边的路径才看
                worst.append({
                    "dest":      dest_key,
                    "station":   info["name"],
                    "code":      code,
                    "mins":      info["mins"],
                    "fb_share":  info["fb_share"],
                    "min_from_fb": info["min_from_fb"],
                    "n_edges":   info["n_edges_gtfs"] + info["n_edges_fb"],
                })
    worst.sort(key=lambda x: (-x["fb_share"], -x["min_from_fb"]))
    with open(out_dir / "worst_fallback_paths.json", "w", encoding="utf-8") as f:
        json.dump(worst[:200], f, ensure_ascii=False, indent=2)

    # 4) 人类可读摘要
    lines = []
    lines.append("=" * 60)
    lines.append("📊 データソース診断 サマリー")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"全駅数（関東圏）: {len(stations)}")
    lines.append(f"全辺数: {len(edges)}")
    lines.append(f"  ├ GTFS由来:    {gtfs_cnt} ({gtfs_cnt*100//len(edges)}%)")
    lines.append(f"  └ Fallback:    {fallback_cnt} ({fallback_cnt*100//len(edges)}%)")
    lines.append("")
    lines.append("── 各運営者からの貢献 ──")
    for op, s in per_op_stats.items():
        lines.append(f"  {op:30s}  {len(s['edge_keys']):>4} 辺")
    lines.append("")
    lines.append("── 各目的地の経路統計 ──")
    for dest_key, d in coverage_full["destinations"].items():
        ss = list(d["stations"].values())
        if not ss:
            continue
        n_total = len(ss)
        n_pure_gtfs = sum(1 for s in ss if s["n_edges_fb"] == 0)
        n_pure_fb   = sum(1 for s in ss if s["n_edges_gtfs"] == 0)
        n_mixed     = n_total - n_pure_gtfs - n_pure_fb
        avg_fb_share = sum(s["fb_share"] for s in ss) / n_total
        avg_fb_min   = sum(s["min_from_fb"] for s in ss) / n_total
        lines.append(f"\n  → {d['dest_name']} ({n_total} 駅)")
        lines.append(f"     完全GTFS経路:   {n_pure_gtfs} 駅 ({n_pure_gtfs*100//n_total}%)")
        lines.append(f"     混合経路:       {n_mixed} 駅 ({n_mixed*100//n_total}%)")
        lines.append(f"     完全Fallback:   {n_pure_fb} 駅 ({n_pure_fb*100//n_total}%)")
        lines.append(f"     平均Fb占有率:   {avg_fb_share*100:.1f}%")
        lines.append(f"     平均Fb所要分:   {avg_fb_min:.1f} 分")

    lines.append("")
    lines.append("── ワースト10 (新宿向け fallback 占有率順) ──")
    sj_list = list(coverage_full["destinations"].get("shinjuku", {}).get("stations", {}).values())
    sj_list_filtered = [s for s in sj_list if s["n_edges_gtfs"] + s["n_edges_fb"] >= 2]
    sj_list_filtered.sort(key=lambda x: (-x["fb_share"], -x["min_from_fb"]))
    for s in sj_list_filtered[:10]:
        lines.append(f"  {s['name']:<10}  {s['mins']:>3}分  fb={s['fb_share']*100:>3.0f}%  fb所要={s['min_from_fb']:>5.1f}分")

    summary = "\n".join(lines)
    print("\n" + summary)
    with open(out_dir / "summary.txt", "w", encoding="utf-8") as f:
        f.write(summary)

    print(f"\n✅ 出力先: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
