/**
 * お気に入り駅の atom 層。
 *
 * 設計は ai-cache.ts と同型:
 *   - **書き込み**: 公開 atom の write 関数が atom 更新 + localStorage 永続化を
 *     アトミックに行う。呼出側の手動 setItem 経路を作らない。
 *   - **復元**: `readStoredFavorites()` 純関数 + `useBootstrapFavorites` hook で
 *     mount 時に 1 回だけ明示的 hydrate（atomWithStorage は採らない、ADR-0003 方針）。
 *
 * データは駅 code の配列のみ（収蔵順）。駅名・座標・通勤時間は stationByNameAtom
 * から派生で反査する — 冗長保存しないことで駅データ更新時の幽霊データを防ぐ。
 */
import { atom } from 'jotai'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { MAX_FAVORITES } from '@/lib/constants'
import { stationByNameAtom } from '@/lib/atoms/data'
import type { Station } from '@/lib/types'

/**
 * localStorage からお気に入り code 配列を読む純関数。
 * 配列でない / 数値でない要素 / 上限超過は防御的に矯正する。
 */
export function readStoredFavorites(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.favorites)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
      .slice(0, MAX_FAVORITES)
  } catch {
    // 壊れた JSON は無視
    return []
  }
}

/** module 私有な base atom。外部からは直接書けない。 */
const _favoritesBaseAtom = atom<number[]>([])

/**
 * お気に入り駅 code 配列（収蔵順）。
 * 読み = 現在値、書き = atom 更新 + localStorage 永続化をアトミックに。
 */
export const favoritesAtom = atom(
  (get) => get(_favoritesBaseAtom),
  (_get, set, next: number[]) => {
    set(_favoritesBaseAtom, next)
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(next))
    } catch {
      // quota 超過などは silent — UX 中断は望まない
    }
  },
)

/**
 * お気に入り toggle。返り値 = 操作が反映されたか。
 * 追加で上限 (MAX_FAVORITES) を超える場合は何もせず false を返す —
 * 呼出側 (StationDrawer) はこれで上限メッセージを出す。
 */
export const toggleFavoriteAtom = atom(null, (get, set, code: number): boolean => {
  const cur = get(_favoritesBaseAtom)
  if (cur.includes(code)) {
    set(favoritesAtom, cur.filter((c) => c !== code))
    return true
  }
  if (cur.length >= MAX_FAVORITES) return false
  set(favoritesAtom, [...cur, code])
  return true
})

/**
 * 収蔵駅の完全 Station 配列（収蔵順）。リスト面板と地図 ★ 標記の共通源。
 * stationByName 未 ready（geojson fetch 前）は空配列で待つ。
 * geojson から消えた code（廃駅化等）は silent に除外される。
 */
export const favoriteStationsAtom = atom<Station[]>((get) => {
  // 全依存を冒頭で読む（derived.ts と同方針 — early-return による依存追跡漏れ防止）。
  const codes = get(favoritesAtom)
  const byName = get(stationByNameAtom)
  if (codes.length === 0 || Object.keys(byName).length === 0) return []
  const byCode = new Map<number, Station>()
  for (const s of Object.values(byName)) byCode.set(s.code, s)
  return codes
    .map((c) => byCode.get(c))
    .filter((s): s is Station => s !== undefined)
})

/**
 * 地図 ★ 標記用の GeoJSON features。
 * MapView の `stations-favorites` source に setData される（ai-highlight と同パターン）。
 */
export const favoriteFeaturesAtom = atom<GeoJSON.Feature[]>((get) =>
  get(favoriteStationsAtom).map((s) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
    properties: { code: s.code, name: s.name, name_en: s.name_en ?? null },
  })),
)

/** お気に入りリスト面板の開閉状態。HeaderMenu が開き、面板自身が閉じる。 */
export const favoritesPanelOpenAtom = atom(false)
