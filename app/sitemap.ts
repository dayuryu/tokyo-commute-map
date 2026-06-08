import type { MetadataRoute } from 'next'
import { DESTINATIONS_META } from '@/lib/destinations'

const base = 'https://kayoha.com'

// メインページの hreflang cluster。ja / zh / en の UI は完訳済みのため
// 3 変種すべてを sitemap に出力し、相互 hreflang で言語ターゲティングを伝える。
// canonical は x-default (ja root) に統一する戦略（app/[locale]/layout.tsx 参照）。
const mainAlternates = {
  languages: {
    ja: `${base}/`,
    zh: `${base}/zh`,
    en: `${base}/en`,
    'x-default': `${base}/`,
  },
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const main: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: mainAlternates,
    },
    {
      url: `${base}/zh`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: mainAlternates,
    },
    {
      url: `${base}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: mainAlternates,
    },
  ]

  // legal / to の深層コンテンツは現状 ja のみ（zh / en は ja-fallback 表示）。
  // 日本語コンテンツの /zh・/en URL を sitemap に載せると重複コンテンツ扱いに
  // なり得るため、翻訳が完了した locale から順次 alternates 付きで追加する。
  const legal: MetadataRoute.Sitemap = [
    'legal',
    'legal/commerce',
    'legal/privacy',
    'legal/ads',
    'legal/credits',
    'legal/contact',
  ].map(path => ({
    url: `${base}/${path}`,
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.3,
  }))

  const destinations: MetadataRoute.Sitemap = DESTINATIONS_META.map(m => ({
    url: `${base}/to/${m.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...main, ...legal, ...destinations]
}
