/**
 * SSG ページ用の静的 messages アクセサ。
 *
 * next-intl の getLocale()/getTranslations() を server component で呼ぶと
 * ルートが dynamic rendering に退化する（setRequestLocale の全面接線が必要）。
 * 完全静的なページ（legal / to landing 等）では params の locale を受け取り、
 * このモジュール経由で messages JSON を直接引く。文言の SSOT は
 * messages/*.json のまま変わらない。
 */
import ja from '@/messages/ja.json'
import zh from '@/messages/zh.json'
import en from '@/messages/en.json'

export const STATIC_MESSAGES = { ja, zh, en } as const

export type StaticMessagesLocale = keyof typeof STATIC_MESSAGES

/** 未知 locale は ja に fallback。 */
export function staticMessages(locale: string) {
  return STATIC_MESSAGES[(locale in STATIC_MESSAGES ? locale : 'ja') as StaticMessagesLocale]
}

/** `{name}` 形式の placeholder を埋める軽量 interpolation。 */
export function fillMessage(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key) => params[key] ?? m)
}

/** ja は prefix 無し、それ以外は `/zh` 等を付けた locale-aware な内部リンク。 */
export function localeHref(locale: string, path: string): string {
  return locale === 'ja' ? path : `/${locale}${path === '/' ? '' : path}`
}
