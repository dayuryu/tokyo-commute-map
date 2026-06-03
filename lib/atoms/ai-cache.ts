/**
 * AI 推薦 24h cache の atom 層（ADR-0003 P4）。
 *
 * 旧 page.tsx ではこの cache を useState で持ち、mount effect で v1 旧形式の互換 +
 * 壊れたデータの silent ignore を手書きで防御していた。本層では：
 *
 *   - **書き込み**: 公開 atom `aiCacheAtom` の write 関数が atom 更新 + localStorage 永続化を
 *     アトミックに行う。呼出側で手動 setItem を書く経路を消滅させる。
 *   - **復元**: `readStoredAiCache()` 純関数 + `useBootstrapAiCache` hook を介して、
 *     useEffect 内で 1 回だけ実行する。`atomWithStorage` の onMount 経路は React Strict
 *     Mode 下で時序が読みにくい case が出るため、本実装は **明示的 hydrate** を採る。
 *
 * 派生 atom (`aiCacheFreshAtom` / `aiRecallAvailableAtom`) は本 cache から純粋に計算され、
 * 消費 component (AiRecallButton / StationDrawer) が直接購読する。
 */
import { atom } from 'jotai'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { ONE_DAY_MS } from '@/lib/constants'
import { selectedStationAtom } from '@/lib/atoms/ui'
import type { CustomStation } from '@/lib/types'
import type { FixedDestination } from '@/lib/destinations'
import type { Recommendation } from '@/lib/ai-recommend/types'

/** AI 推薦の真調用 1 回分のキャッシュ。24h で fresh 判定が落ちる。
 *  v1 旧形式 (custom 非対応・customStation フィールド無し) も互換読込可能。 */
export interface AiCache {
  /** 30 fixed slug、または 'custom' (custom destination 指定時) */
  destination:    FixedDestination | 'custom'
  /** destination === 'custom' の時のみ保持。fixed 時は undefined。 */
  customStation?: CustomStation
  recs:           Recommendation[]
  /** ISO timestamp。真調用が完了した時刻 — fresh 判定の基点。 */
  usedAt:         string
}

/** 旧 page.tsx の局部 helper と同じ — 24h 以内なら fresh。 */
export function isAiCacheFresh(c: AiCache | null): boolean {
  if (!c) return false
  const ageMs = Date.now() - new Date(c.usedAt).getTime()
  return ageMs < ONE_DAY_MS
}

/**
 * localStorage から AI cache を読む純関数。旧 mount effect で書かれていた防御を内包：
 * - 基本フィールド (recs/destination/usedAt) が揃っているか
 * - custom destination の場合、customStation.code が number か
 * - JSON parse 失敗 / 不完全 schema は silent ignore（null を返す）
 *
 * `useBootstrapAiCache` から useEffect 内で 1 回呼ばれる。
 */
export function readStoredAiCache(): AiCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.aiCache)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AiCache
    const baseOk = parsed?.recs?.length && parsed.destination && parsed.usedAt
    // custom destination は customStation 必須、無ければ壊れた entry として無視
    const customOk = parsed?.destination !== 'custom' ||
      (parsed.customStation && typeof parsed.customStation.code === 'number')
    if (baseOk && customOk) return parsed
  } catch {
    // 壊れた JSON は無視
  }
  return null
}

/** module 私有な base atom。外部からは直接書けない。 */
const _aiCacheBaseAtom = atom<AiCache | null>(null)

/**
 * AI 推薦 cache。読み = 現在値、書き = atom 更新 + localStorage 永続化をアトミックに。
 * 呼出側で手動 localStorage.setItem を書く経路を消滅させ、保存漏れを構造的に防ぐ。
 */
export const aiCacheAtom = atom(
  (get) => get(_aiCacheBaseAtom),
  (_get, set, next: AiCache | null) => {
    set(_aiCacheBaseAtom, next)
    if (typeof window === 'undefined') return
    try {
      if (next === null) localStorage.removeItem(STORAGE_KEYS.aiCache)
      else localStorage.setItem(STORAGE_KEYS.aiCache, JSON.stringify(next))
    } catch {
      // quota 超過などは silent — UX 中断は望まない
    }
  },
)

/** 24h 以内に新規推薦が行われたか。AiRecallButton / DestinationAsk hero CTA の表示分岐。 */
export const aiCacheFreshAtom = atom((get) => isAiCacheFresh(get(aiCacheAtom)))

/**
 * 現在開いている駅 drawer が aiCache.recs に含まれるか。
 * StationDrawer 内「← AI 推薦に戻る」リンクの表示判定。
 * 旧 page.tsx で JSX 内に直書きしていた式を atom 化。 */
export const aiRecallAvailableAtom = atom((get) => {
  // 全依存を冒頭で読む（jotai の依存追跡を確実にするため、derived.ts と同方針）。
  const cache = get(aiCacheAtom)
  const selected = get(selectedStationAtom)
  if (!cache || !selected) return false
  return cache.recs.some((r) => r.station_name === selected.name)
})
