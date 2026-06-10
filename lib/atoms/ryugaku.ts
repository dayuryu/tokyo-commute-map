/**
 * /ryugaku 測試 → 地図導流の highlight 状態。
 *
 * 結果頁 CTA が `/?rstations=駅名,...&rc=型色hex` で地図へ遷移し、
 * page.tsx の mount effect が query を読んで ryugakuHighlightAtom に set する。
 * 駅名は geojson 正規名（消歧後缀込み、例: 中野(東京)）— quiz-data.ts の
 * stationKeys が SSOT（表示名 stations とは別系統）。
 */
import { atom } from 'jotai'
import { stationByNameAtom } from './data'

export type RyugakuHighlight = {
  /** geojson 正規駅名（消歧後缀込み） */
  stations: string[]
  /** 型の代表色（#rrggbb）。ring / chip の描画色 */
  color: string
} | null

export const ryugakuHighlightAtom = atom<RyugakuHighlight>(null)

/**
 * 地図 highlight 用 GeoJSON features。stationByName 未 ready 時は空（ready 後に再評価）。
 * AI highlight (derived.ts) と同型のパターン。
 */
export const ryugakuHighlightFeaturesAtom = atom<GeoJSON.Feature[]>((get) => {
  const hl = get(ryugakuHighlightAtom)
  const stationByName = get(stationByNameAtom)
  if (!hl || Object.keys(stationByName).length === 0) return []
  const features: GeoJSON.Feature[] = []
  for (const name of hl.stations) {
    const s = stationByName[name]
    if (!s) {
      console.warn(`[ryugaku-highlight] stationByName miss for "${name}"`)
      continue
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { code: s.code, name: s.name, color: hl.color },
    })
  }
  return features
})
