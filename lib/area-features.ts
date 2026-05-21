/**
 * 周辺の特徴（駅周辺エリアの AI 要約データ）
 *
 * - データソース: public/data/area_features.json
 *   関東 1843 駅の「周辺エリアの特徴」を 50〜75 字程度の日本語短文で要約
 * - 生成: scripts/generate_area_features.py（外部 LLM 経由でバッチ生成）
 * - 用途: StationDrawer の「周辺の特徴」DetailRow
 * - 注意: AI 生成の参考情報。景表法・薬機法的に強い断定はせず、最新の実況確認を促す。
 */

export interface AreaFeaturesMeta {
  generated_at:           string
  generator:              string
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

const inflight: Map<string, Promise<AreaFeaturesData | null>> = new Map()

/**
 * locale ごとの area features を取得。失敗時は null。
 * - 'ja' (既定): /data/area_features.json
 * - 'zh': /data/area_features_zh.json (未生成時は ja fallback)
 * - 'en': /data/area_features_en.json (未生成時は ja fallback)
 *
 * 多重呼出しは locale 単位の inflight キャッシュで 1 回に集約。
 */
export async function loadAreaFeaturesData(locale: string = 'ja'): Promise<AreaFeaturesData | null> {
  const key = locale === 'zh' || locale === 'en' ? locale : 'ja'
  const cached = inflight.get(key)
  if (cached) return cached

  const promise = (async () => {
    const primary = key === 'ja' ? '/data/area_features.json' : `/data/area_features_${key}.json`
    try {
      const r = await fetch(primary)
      if (r.ok) return (await r.json()) as AreaFeaturesData
    } catch {
      /* fallthrough to ja fallback below */
    }
    // 非 ja locale で対応 JSON が無い場合は ja にフォールバック（中文 / en 版がまだ
    // 生成されていない段階での graceful degrade）。
    if (key !== 'ja') {
      try {
        const r = await fetch('/data/area_features.json')
        if (r.ok) return (await r.json()) as AreaFeaturesData
      } catch {
        /* fallthrough */
      }
    }
    return null
  })()
  inflight.set(key, promise)
  return promise
}
