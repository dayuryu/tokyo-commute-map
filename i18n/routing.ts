import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ja', 'zh', 'en'],
  defaultLocale: 'ja',
  // `/` は日本語 (default)、`/zh` のみ prefix。日本語の既存 URL を温存し、
  // 旧 SEO ランクへの影響をゼロにする戦略。
  localePrefix: 'as-needed',
  // Accept-Language ヘッダ + cookie で自動切替。手動切替 UI を必ず併設すること。
  localeDetection: true,
})

export type AppLocale = (typeof routing.locales)[number]
