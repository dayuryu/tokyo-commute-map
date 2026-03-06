#!/usr/bin/env python3
"""
Sprint 1 核心脚本：station_database → stations.geojson
数据源：https://github.com/Seo-4d696b75/station_database
用法：python3 build_stations_geojson.py <station_database目录>

输出：stations.geojson（供 MapLibre GL JS 直接使用）
"""

import sys
import csv
import json
import math
import networkx as nx
from pathlib import Path
from collections import defaultdict

# ── 关东一都三县的都道府県コード ──────────────────
KANTO_PREFECTURES = {11, 12, 13, 14}  # 埼玉, 千葉, 東京, 神奈川
# 适当扩大一点，纳入周边常用居住圈
KANTO_EXTENDED = {8, 9, 10, 11, 12, 13, 14, 19}  # 加上茨城/栃木/群馬/山梨

# ── 核心目的地（新宿/渋谷/東京 的 station code）──
# 需要第一次运行后从日志确认，这里先用名字匹配
DESTINATION_NAMES = {
    "shinjuku": "新宿",
    "shibuya":  "渋谷",
    "tokyo":    "東京",
}

# ── 站间距离 → 行驶时间估算（分钟）────────────────
# 用两站间直线距离 + 平均速度反推
# 电车平均运营速度（含停站）约 35km/h
AVG_SPEED_KMH = 35.0

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """两点间直线距离（千米）"""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def dist_to_minutes(km: float) -> float:
    """直线距离 → 估算行驶分钟数（+30%迂回系数）"""
    actual_km = km * 1.3  # 铁路线路比直线长约30%
    return (actual_km / AVG_SPEED_KMH) * 60

# ── STEP 1: 读取站点数据 ───────────────────────────
def load_stations(csv_path: Path) -> dict:
    """
    返回 {code(int): {name, lat, lng, prefecture, closed}}
    只保留关东+周边、非废站的站点
    """
    stations = {}
    skipped_closed = 0
    skipped_region = 0

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 过滤废站
            if row["closed"].strip() == "true":
                skipped_closed += 1
                continue

            pref = int(row["prefecture"])
            # 过滤非关东
            if pref not in KANTO_EXTENDED:
                skipped_region += 1
                continue

            code = int(row["code"])
            try:
                lat = float(row["lat"])
                lng = float(row["lng"])
            except ValueError:
                continue

            stations[code] = {
                "name":       row["name"],
                "lat":        lat,
                "lng":        lng,
                "prefecture": pref,
            }

    print(f"  ✅ 加载站点：{len(stations)} 个")
    print(f"     跳过废站：{skipped_closed}，跳过圈外：{skipped_region}")
    return stations

# ── STEP 2: 读取 register.csv → 构建图 ────────────
def build_graph(register_path: Path, stations: dict) -> nx.Graph:
    """
    register.csv: station_code, line_code, index, numbering
    同一 line_code 内按 index 排序，相邻两站连边
    边权重 = 估算行驶分钟数
    """
    G = nx.Graph()

    # 加节点
    for code, info in stations.items():
        G.add_node(code, **info)

    # 按路线分组
    lines: dict[int, list[tuple[int, int]]] = defaultdict(list)
    total_rows = 0
    with open(register_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1
            sc = int(row["station_code"])
            lc = int(row["line_code"])
            idx = int(row["index"])
            if sc in stations:  # 只处理关东站点
                lines[lc].append((idx, sc))

    print(f"  📋 register.csv 行数：{total_rows}，关东相关路线：{len(lines)}")

    # 连边
    edge_count = 0
    for lc, stops in lines.items():
        stops.sort(key=lambda x: x[0])  # 按 index 排序
        for i in range(len(stops) - 1):
            _, code_a = stops[i]
            _, code_b = stops[i + 1]

            if code_a not in stations or code_b not in stations:
                continue

            a = stations[code_a]
            b = stations[code_b]
            km = haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
            minutes = dist_to_minutes(km)

            # 过滤异常边（同站跨线记录、或站间距异常远）
            if km < 0.05 or km > 80:
                continue

            # 保留最短时间（多条线路同区间取最快）
            if G.has_edge(code_a, code_b):
                if G[code_a][code_b]["weight"] > minutes:
                    G[code_a][code_b]["weight"] = minutes
            else:
                G.add_edge(code_a, code_b, weight=minutes, km=round(km, 2))
                edge_count += 1

    print(f"  🔗 构建边：{edge_count} 条")
    return G

# ── STEP 3: Dijkstra → 通勤时间 ───────────────────
def find_station_code(stations: dict, name: str) -> int | None:
    """按站名查找 code（精确匹配）"""
    for code, info in stations.items():
        if info["name"] == name:
            return code
    # 模糊匹配
    for code, info in stations.items():
        if name in info["name"]:
            return code
    return None

def compute_commute(G: nx.Graph, stations: dict,
                    dest_name: str, cutoff: int = 120) -> dict:
    """返回 {station_code: minutes}"""
    target = find_station_code(stations, dest_name)
    if not target:
        print(f"  ❌ 找不到站点：{dest_name}")
        return {}
    print(f"  🎯 目标：{stations[target]['name']} (code={target})")

    lengths = nx.single_source_dijkstra_path_length(
        G, target, cutoff=cutoff, weight="weight"
    )
    return dict(lengths)

# ── STEP 4: 输出 GeoJSON ──────────────────────────
def build_geojson(stations: dict,
                  commute_results: dict[str, dict]) -> dict:
    """
    合并多目的地通勤时间，输出 GeoJSON FeatureCollection
    """
    features = []
    for code, info in stations.items():
        props = {
            "code":   code,
            "name":   info["name"],
        }
        # 写入各目的地通勤时间
        has_any = False
        for dest_key, results in commute_results.items():
            if code in results:
                mins = int(results[code])
                props[f"min_to_{dest_key}"] = mins
                # 色阶：每15分钟一档，0~5+
                props[f"bucket_{dest_key}"] = min(mins // 15, 5)
                has_any = True

        # 没有任何目的地可达的站点跳过
        if not has_any:
            continue

        # 用新宿的bucket作为默认显示
        if "min_to_shinjuku" in props:
            props["bucket"] = props["bucket_shinjuku"]
        elif "min_to_shibuya" in props:
            props["bucket"] = props["bucket_shibuya"]
        else:
            props["bucket"] = props.get("bucket_tokyo", 5)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [info["lng"], info["lat"]]  # GeoJSON: [lon, lat]
            },
            "properties": props
        })

    return {"type": "FeatureCollection", "features": features}

# ── MAIN ──────────────────────────────────────────
def main():
    # 目录参数
    if len(sys.argv) < 2:
        # 默认寻找 ./station_database
        base = Path("./station_database/out/main")
        if not base.exists():
            base = Path("./out/main")
        if not base.exists():
            print("用法：python3 build_stations_geojson.py <station_database目录>")
            print("或在 station_database/ 的 clone 目录下直接运行")
            sys.exit(1)
    else:
        base = Path(sys.argv[1]) / "out" / "main"
        if not base.exists():
            base = Path(sys.argv[1])

    station_csv  = base / "station.csv"
    register_csv = base / "register.csv"

    for f in [station_csv, register_csv]:
        if not f.exists():
            print(f"❌ 文件不存在：{f}")
            sys.exit(1)

    print("=" * 55)
    print("🚄 东京圈通勤时间计算器 v2.0")
    print(f"   数据来源：{base}")
    print("=" * 55)

    print("\n📂 Step 1: 读取站点数据...")
    stations = load_stations(station_csv)

    print("\n📐 Step 2: 构建路线图...")
    G = build_graph(register_csv, stations)

    print(f"\n   图节点数：{G.number_of_nodes()}")
    print(f"   图边数：  {G.number_of_edges()}")

    print("\n⚙️  Step 3: 计算通勤时间...")
    commute_results = {}
    for dest_key, dest_name in DESTINATION_NAMES.items():
        print(f"\n  → {dest_name}:")
        result = compute_commute(G, stations, dest_name)
        commute_results[dest_key] = result

        # 统计
        buckets = {}
        for mins in result.values():
            b = min(int(mins) // 15, 5)
            buckets[b] = buckets.get(b, 0) + 1
        labels = {0:"<15分",1:"15-29",2:"30-44",3:"45-59",4:"60-74",5:"75+"}
        for k in sorted(buckets):
            print(f"     {labels[k]}: {buckets[k]} 站")

    print("\n💾 Step 4: 生成 GeoJSON...")
    geojson = build_geojson(stations, commute_results)
    total = len(geojson["features"])

    output_path = Path("./stations.geojson")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = output_path.stat().st_size // 1024
    print(f"  ✅ 输出完成：{total} 个站点，{size_kb} KB → {output_path}")

    # 抽样验证
    print("\n📍 抽样验证（到新宿）：")
    sample_names = ["渋谷","池袋","中野","吉祥寺","武蔵小杉","南浦和","大宮","横浜","千葉"]
    shinjuku_result = commute_results.get("shinjuku", {})
    for feat in geojson["features"]:
        n = feat["properties"]["name"]
        if n in sample_names and "min_to_shinjuku" in feat["properties"]:
            print(f"   {n:8s} → {feat['properties']['min_to_shinjuku']:3d} 分钟")

if __name__ == "__main__":
    main()
