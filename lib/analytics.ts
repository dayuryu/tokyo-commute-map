/**
 * GA4 イベント送信の薄いラッパー。
 *
 * **同意ゲートの仕組み**: GA4 script（gtag.js）は AnalyticsGate が
 * cookie 同意 = 'all' の時だけ注入する。未同意 / 未設定環境では
 * `window.gtag` が存在しないため、`trackEvent` は何もせず黙って戻る —
 * 呼出側（埋点）は同意状態を一切気にしなくてよい。
 *
 * **イベント命名**: GA4 推奨の snake_case。本プロジェクトのイベント一覧:
 *   - ai_entry_click        { entry: 'ask_hero' | 'recall_button' | 'drawer_link' }
 *   - ai_wizard_step        { step: 1-6 }
 *   - ai_result_shown       { cached: boolean }
 *   - ai_error              { reason: string }
 *   - ai_result_station_click { station: string }
 *   - affiliate_click       { provider: 'suumo' | 'homes' | 'chintai', station: string }
 */

/** GA4 measurement ID。未設定（空文字）なら AnalyticsGate は何も注入しない。 */
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? ''

type EventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * GA4 カスタムイベントを送信する。
 * gtag 未注入（未同意 / ID 未設定 / SSR）の場合は no-op。
 */
export function trackEvent(name: string, params?: EventParams): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', name, params)
}
