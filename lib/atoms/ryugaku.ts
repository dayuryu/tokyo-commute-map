/**
 * /ryugaku 測試 → 地図導流の highlight 状態（domain.ts と同じ書き込み封装方針）。
 *
 * **設計**:
 *   - base atom は **module 私有で export しない**。外部からは読み取り専用の
 *     `ryugakuHighlightAtom` と、語義つき write atom 2 つのみ公開する。
 *   - `bootstrapRyugakuHighlightAtom` — page mount 時に location.search を渡して
 *     `?rstations=駅名,...&rc=型色hex` を解析・検証して set。set したかを返す
 *     （page 側はその真偽で onboarding skip を決める）。
 *   - `dismissRyugakuHighlightAtom` — chip ✕ から。**「状態クリア」と「URL から
 *     query を剥がす」は不変量として成対**（剥がさないと reload で環が復活する）。
 *     この対を本 atom に閉じ込め、将来第二の解除経路が増えても漏れない。
 *
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

/** 本体。module 私有 — 外部は下記の読み取り専用 atom + write atom 経由のみ。 */
const _ryugakuHighlightBaseAtom = atom<RyugakuHighlight>(null)

/** 現在の highlight（読み取り専用）。null = /ryugaku 導流なし。 */
export const ryugakuHighlightAtom = atom((get) => get(_ryugakuHighlightBaseAtom))

/**
 * page mount 時の query 解析 + set。set した場合 true を返す。
 * 検証: rstations 非空（最大 8 駅）、rc は 6 桁 hex のみ採用（不正は brand 朱に縮退）。
 */
export const bootstrapRyugakuHighlightAtom = atom(
  null,
  (_get, set, search: string): boolean => {
    try {
      const sp = new URLSearchParams(search)
      const r = sp.get('rstations')
      if (!r) return false
      const stations = r.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)
      if (stations.length === 0) return false
      const rc = sp.get('rc') ?? ''
      const color = /^[0-9a-fA-F]{6}$/.test(rc) ? `#${rc}` : '#a8332b'
      set(_ryugakuHighlightBaseAtom, { stations, color })
      return true
    } catch {
      return false
    }
  },
)

/**
 * highlight 解除。状態クリアと URL query 剥離（reload 再点灯防止）を成対で実行。
 * 履歴は汚さない（replaceState）。
 */
export const dismissRyugakuHighlightAtom = atom(null, (_get, set) => {
  set(_ryugakuHighlightBaseAtom, null)
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('rstations')
    url.searchParams.delete('rc')
    window.history.replaceState(null, '', url.pathname + url.search)
  } catch {}
})

/**
 * 地図 highlight 用 GeoJSON features（純派生）。stationByName 未 ready 時は空
 * （ready 後に jotai が再評価）。AI highlight (derived.ts) と同型のパターン。
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
