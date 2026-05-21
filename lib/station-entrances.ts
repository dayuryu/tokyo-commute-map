/**
 * 駅出入口座標の facade。
 *
 * - 出典: OpenStreetMap (Overpass API)
 * - 生成スクリプト: scripts/build_station_entrances.py
 * - 出力先: public/data/station_entrances.json
 *
 * 用途: StationDrawer の「ストリートビュー」リンクを駅本体ではなく
 * 駅出入口の座標に向ける。Google Street View が屋外パノラマを優先選択
 * するため、月台 indoor pano が表示される問題を回避する。
 *
 * カバレッジ: 1843 駅中 ~77% (1420 駅)。未収録駅は前端で駅本体座標に
 * フォールバックする。
 */

export interface EntranceLocation {
  lat:         number
  lon:         number
  source:      string  // e.g. 'osm_train_station_entrance' / 'osm_subway_entrance'
  distance_m:  number  // 駅本体からの距離
}

export type EntranceMap = Record<string, EntranceLocation>  // station_code → EntranceLocation

interface RawEntrancesJson {
  _meta:     Record<string, unknown>
  entrances: EntranceMap
}

let inflight: Promise<EntranceMap | null> | null = null

/**
 * 出入口座標 map をクライアントで取得。失敗時は null（前端は駅本体座標にフォールバック）。
 * 多重呼出しは inflight キャッシュで 1 回に集約。
 */
export async function loadStationEntrances(): Promise<EntranceMap | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/data/station_entrances.json')
      if (!r.ok) return null
      const data = (await r.json()) as RawEntrancesJson
      return data.entrances ?? null
    } catch {
      return null
    }
  })()
  return inflight
}

/**
 * 駅 code に紐づく Street View URL 用座標を返す。
 * 出入口データがあれば優先、無ければ駅本体座標にフォールバック。
 */
export function getStreetViewCoords(
  stationCode: number,
  fallbackLat: number,
  fallbackLon: number,
  entrances: EntranceMap | null,
): { lat: number; lon: number } {
  const e = entrances?.[String(stationCode)]
  if (e) return { lat: e.lat, lon: e.lon }
  return { lat: fallbackLat, lon: fallbackLon }
}
