/**
 * 派生 atom 層 — 複数の上流 atom から計算される値を集約する（ADR-0003 P4）。
 *
 * 旧 page.tsx の `useMemo` で組み立てていた派生値を atom 化することで、消費側 component
 * が直接 useAtomValue で取得でき、page を経由する props drilling と中継 useMemo が
 * 不要になる。再計算条件は jotai が依存 atom の変化を自動追跡する。
 *
 * **このファイルの境界**:
 * - 純粋な派生のみ。書き込み口や副作用は持たない。
 * - 上流 atom を組合せる中継層であり、新しい状態を保持しない。
 */
import { atom } from 'jotai'
import { computeCommutes } from '@/lib/dijkstra'
import type { CustomCommutesMap } from '@/lib/types'
import { customStationAtom, destinationAtom, secondCustomStationAtom } from '@/lib/atoms/domain'
import { graphAtom, stationByNameAtom } from '@/lib/atoms/data'
import { aiCacheAtom, isAiCacheFresh } from '@/lib/atoms/ai-cache'

/**
 * custom destination 時の全駅 → custom 駅 通勤 map。
 * MapView の paint property と StationDrawer の通勤時間表示の single source of truth。
 * customStation / graph が変化したときのみ再計算（jotai が依存追跡）。
 */
export const customCommutesAtom = atom<CustomCommutesMap>((get) => {
  const customStation = get(customStationAtom)
  const graph = get(graphAtom)
  if (!customStation || !graph) return null
  return computeCommutes(graph, customStation.code)
})

/**
 * 2 つ目の通勤先が custom 駅の時の全駅 → 駅 通勤 map。customCommutesAtom と同型。
 * second が fixed slug の場合は geojson の min_to_<slug> を直接読むため null のまま。
 */
export const secondCommutesAtom = atom<CustomCommutesMap>((get) => {
  const station = get(secondCustomStationAtom)
  const graph = get(graphAtom)
  if (!station || !graph) return null
  return computeCommutes(graph, station.code)
})

/**
 * AI 推薦 20 駅の地図 highlight features。aiCache が 24h 内 fresh な時のみ非空。
 * MapView の `stations-ai-highlight` source に setData される。
 *
 * 旧 page.tsx の useMemo と等価ロジック：
 * - cache が fresh でない / stationByName 未 ready / destination が cache 時点と不一致 → 空
 * - destination 切替で過去推薦の赤外環が残る UX 問題は cacheDestMatches 判定で防止
 *   （AiRecallButton で recall すると destination が cache 対応値に戻り、highlight も復活）
 */
export const aiHighlightFeaturesAtom = atom<GeoJSON.Feature[]>((get) => {
  // **全依存を冒頭で読む** — jotai の動的依存追跡が early-return で抜けるのを防ぐ。
  // edge case（特に React Strict Mode 双 mount）で「初回 evaluate 時に early-return
  // した atom が以降の依存集に入らない」ケースを構造的に回避する。
  const cache = get(aiCacheAtom)
  const stationByName = get(stationByNameAtom)
  const destination = get(destinationAtom)
  const customStation = get(customStationAtom)

  if (!isAiCacheFresh(cache)) return []
  // stationByName は geojson fetch 完了後に set される。未 ready 時は空 features で待つ。
  if (Object.keys(stationByName).length === 0) return []
  // destination が aiCache 生成時と一致しない場合は highlight を表示しない（UX 問題対策）。
  const cacheDestMatches = cache!.destination === 'custom'
    ? (destination === 'custom' && customStation?.code === cache!.customStation?.code)
    : destination === cache!.destination
  if (!cacheDestMatches) return []
  const features: GeoJSON.Feature[] = []
  cache!.recs.forEach((r, idx) => {
    const s = stationByName[r.station_name]
    // backend `lib/ai-recommend/openai.ts` で validNames 厳格 filter 済み、geojson 内
    // 同名 5 駅は括弧後缀で消歧済み（田町(東京) 等）。理論 100% 命中。
    // TODO v2.1: backend に station_code を返させて stationByCode lookup に切替、
    //           未消歧同名駅の歧義を根絶。
    if (!s) {
      console.warn(`[ai-highlight] stationByName miss for "${r.station_name}"`)
      return
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { code: s.code, name: s.name, rank: idx + 1 },
    })
  })
  return features
})
