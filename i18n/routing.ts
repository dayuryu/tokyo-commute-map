import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // TODO(i18n-en): 英語版は次フェーズ。レイアウト崩れ (ボタン幅・Legend ラベル・
  // tagline 行高) を解決してから ['ja', 'zh', 'en'] に戻す。messages/en.json と
  // WelcomeOverlay の EN LocaleLink は残置 (再開時の参考に)。
  locales: ['ja', 'zh'],
  defaultLocale: 'ja',
  // `/` は日本語 (default)、`/zh` のみ prefix。日本語の既存 URL を温存し、
  // 旧 SEO ランクへの影響をゼロにする戦略。
  localePrefix: 'as-needed',
  // Accept-Language ヘッダ + cookie で自動切替。手動切替 UI を必ず併設すること。
  localeDetection: true,
})

export type AppLocale = (typeof routing.locales)[number]
