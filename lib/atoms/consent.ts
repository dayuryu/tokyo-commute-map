/**
 * Cookie 同意ステータスの atom 層。
 *
 * 設計は favorites.ts / ai-cache.ts と同型:
 *   - **書き込み**: 公開 atom の write 関数が atom 更新 + localStorage 永続化を
 *     アトミックに行う。呼出側の手動 setItem 経路を作らない。
 *   - **復元**: `hydrateConsentAtom`（冪等）で mount 時に 1 回だけ明示的 hydrate。
 *
 * CookieConsent（横幅 UI）と AnalyticsGate（GA4 script 注入）の 2 consumer が
 * 同じ状態を購読する — 「すべて承認」を選んだ瞬間に GA4 が活性化する連動は
 * この atom が担保する。
 */
import { atom } from 'jotai'
import { STORAGE_KEYS } from '@/lib/storage-keys'

export type CookieConsentValue = 'all' | 'necessary'

/** localStorage から同意ステータスを読む純関数。未保存 / 不正値は null。 */
export function readStoredConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEYS.cookieConsent)
    if (v === 'all' || v === 'necessary') return v
  } catch {}
  return null
}

/**
 * module 私有な base atom。外部からは直接書けない。
 * undefined = 未 hydrate（localStorage 未読）/ null = 読了したが未選択 /
 * 'all' | 'necessary' = 選択済み。
 */
const _consentBaseAtom = atom<CookieConsentValue | null | undefined>(undefined)

/**
 * Cookie 同意ステータス。
 * 読み = 現在値、書き = atom 更新 + localStorage 永続化をアトミックに。
 */
export const cookieConsentAtom = atom(
  (get) => get(_consentBaseAtom),
  (_get, set, next: CookieConsentValue) => {
    set(_consentBaseAtom, next)
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEYS.cookieConsent, next)
    } catch {
      // quota 超過などは silent — UX 中断は望まない
    }
  },
)

/**
 * hydrate 用 write atom（冪等）。
 * AnalyticsGate / CookieConsent の双方が mount 時に呼ぶが、base が undefined の
 * 間だけ localStorage を読む — 後勝ち上書きで選択済み状態を巻き戻さない。
 */
export const hydrateConsentAtom = atom(null, (get, set) => {
  if (get(_consentBaseAtom) !== undefined) return
  set(_consentBaseAtom, readStoredConsent())
})
