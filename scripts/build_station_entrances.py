"""
OpenStreetMap Overpass API から関東+山梨の鉄道駅 entrance ノードを取得し、
public/data/stations.geojson の 1843 駅にマッチさせて
public/data/station_entrances.json を生成する。

出力スキーマ:
    {
      "<station_code>": { "lat": 35.123, "lon": 139.456, "source": "osm_subway_entrance" },
      ...
    }

マッチング戦略:
    各駅について、半径 ENTRANCE_RADIUS_M 以内で最近の entrance ノードを採用。
    無い場合は出力に含めない（前端は駅本体座標に fallback）。

実行:
    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 \\
      /c/Users/81704/AppData/Local/Programs/Python/Python312/python.exe \\
      scripts/build_station_entrances.py
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
STATIONS_GEOJSON = REPO_ROOT / "public" / "data" / "stations.geojson"
OUTPUT_JSON = REPO_ROOT / "public" / "data" / "station_entrances.json"

# bbox: stations.geojson 観測範囲 (lat 34.98-36.85, lon 138.66-140.86) に余裕を持たせる
BBOX = (34.9, 138.5, 37.0, 141.0)  # (south, west, north, east)
ENTRANCE_RADIUS_M = 300  # 駅本体から半径 300m 以内の entrance を当該駅のものとみなす

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = f"""
[out:json][timeout:180];
(
  node["railway"="subway_entrance"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["railway"="train_station_entrance"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out body;
"""


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine 距離 (meters)."""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def fetch_overpass() -> list[dict]:
    """Overpass API から entrance node を取得。"""
    print(f"[info] Overpass POST {OVERPASS_URL} (bbox={BBOX})")
    headers = {
        "User-Agent": "kayoha-station-entrance-builder/1.0 (https://kayoha.com)",
        "Accept": "application/json",
    }
    t0 = time.time()
    r = requests.post(OVERPASS_URL, data={"data": OVERPASS_QUERY},
                       headers=headers, timeout=300)
    r.raise_for_status()
    elapsed = time.time() - t0
    data = r.json()
    elements = data.get("elements", [])
    print(f"[info] Overpass returned {len(elements)} elements in {elapsed:.1f}s")
    return elements


def load_stations() -> list[dict]:
    g = json.loads(STATIONS_GEOJSON.read_text(encoding="utf-8"))
    out = []
    for f in g["features"]:
        lon, lat = f["geometry"]["coordinates"]
        out.append({
            "code": f["properties"]["code"],
            "name": f["properties"]["name"],
            "lat": lat,
            "lon": lon,
        })
    return out


def match_entrances(stations: list[dict], entrances: list[dict]) -> dict:
    """各駅について半径 ENTRANCE_RADIUS_M 以内で最近の entrance を採用。"""
    result: dict[str, dict] = {}
    matched_count = 0
    by_railway_tag: dict[str, int] = {}

    for st in stations:
        best: tuple[float, dict] | None = None  # (distance, entrance)
        for ent in entrances:
            d = haversine_m(st["lat"], st["lon"], ent["lat"], ent["lon"])
            if d > ENTRANCE_RADIUS_M:
                continue
            if best is None or d < best[0]:
                best = (d, ent)
        if best is None:
            continue
        dist, ent = best
        tags = ent.get("tags", {})
        railway_tag = tags.get("railway", "unknown")
        by_railway_tag[railway_tag] = by_railway_tag.get(railway_tag, 0) + 1
        result[str(st["code"])] = {
            "lat": round(ent["lat"], 7),
            "lon": round(ent["lon"], 7),
            "source": f"osm_{railway_tag}",
            "distance_m": round(dist, 1),
        }
        matched_count += 1

    print(f"[info] matched {matched_count} / {len(stations)} stations "
          f"({matched_count / len(stations) * 100:.1f}% coverage)")
    print(f"[info] by railway tag: {by_railway_tag}")
    return result


def main() -> None:
    print("[step] loading stations.geojson ...")
    stations = load_stations()
    print(f"[info] loaded {len(stations)} stations")

    print("[step] fetching OSM entrance nodes ...")
    raw_elements = fetch_overpass()
    entrances = [
        {"lat": e["lat"], "lon": e["lon"], "tags": e.get("tags", {})}
        for e in raw_elements
        if e.get("type") == "node" and "lat" in e and "lon" in e
    ]
    print(f"[info] {len(entrances)} entrance nodes after filtering")

    print("[step] matching entrances to stations ...")
    result = match_entrances(stations, entrances)

    meta = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "OpenStreetMap via Overpass API",
        "bbox": list(BBOX),
        "entrance_radius_m": ENTRANCE_RADIUS_M,
        "matched_stations": len(result),
        "total_stations": len(stations),
    }
    output = {"_meta": meta, "entrances": result}
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2),
                            encoding="utf-8")
    size_kb = OUTPUT_JSON.stat().st_size / 1024
    print(f"[done] wrote {OUTPUT_JSON.relative_to(REPO_ROOT)} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as e:
        print(f"[error] Overpass HTTP {e.response.status_code}: {e.response.text[:500]}", file=sys.stderr)
        sys.exit(1)
