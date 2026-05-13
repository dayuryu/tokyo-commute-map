/**
 * 周辺の特徴（駅周辺エリアの AI 要約データ）
 *
 * - データソース: public/data/area_features.json
 *   関東 1843 駅の「周辺エリアの特徴」を 50〜75 字程度の日本語短文で要約
 * - 生成: scripts/generate_area_features.py（Claude.ai 経由でバッチ生成）
 * - 用途: StationDrawer の「周辺の特徴」DetailRow
 * - 注意: AI 生成の参考情報。景表法・薬機法的に強い断定はせず、最新の実況確認を促す。
 */

export interface AreaFeaturesMeta {
  generated_at:           string
  model:                  string
  station_count_target:   number
  completed_batches:      number[]
  disclaimer:             string
  last_updated?:          string
  [key: string]:          unknown
}

export interface AreaFeaturesData {
  _meta:    AreaFeaturesMeta
  stations: Record<string, string>  // 駅名 → 特徴文字列
}

/** 駅名 → 周辺特徴文字列の map */
export type AreaFeatureMap = Record<string, string>

let inflight: Promise<AreaFeaturesData | null> | null = null

/**
 * /data/area_features.json を取得。失敗時は null。
 * 多重呼出しは inflight キャッシュで 1 回に集約。
 */
export async function loadAreaFeaturesData(): Promise<AreaFeaturesData | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/data/area_features.json')
      if (!r.ok) return null
      return (await r.json()) as AreaFeaturesData
    } catch {
      return null
    }
  })()
  return inflight
}
