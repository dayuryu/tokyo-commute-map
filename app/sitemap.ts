import type { MetadataRoute } from 'next'
import { DESTINATIONS_META } from '@/lib/destinations'
import { loadStationPages } from '@/lib/station-pages/data'

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // 通勤先ガイド hub（/to）— 30 駅個別頁への internal link 集約点。
  const toHub: MetadataRoute.Sitemap = [
    {
      url: `${base}/to`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: {
          ja: `${base}/to`,
          zh: `${base}/zh/to`,
          en: `${base}/en/to`,
          'x-default': `${base}/to`,
        },
      },
    },
  ]

  // /to/[slug] は 30 駅すべて ja / zh / en 完訳済み（destinations_v2/{zh,en}/）。
  // ja URL を代表 entry とし、各駅で 3 言語の相互 hreflang を出力する。
  const destinations: MetadataRoute.Sitemap = DESTINATIONS_META.map(m => ({
    url: `${base}/to/${m.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
    alternates: {
      languages: {
        ja: `${base}/to/${m.slug}`,
        zh: `${base}/zh/to/${m.slug}`,
        en: `${base}/en/to/${m.slug}`,
        'x-default': `${base}/to/${m.slug}`,
      },
    },
  }))

  // 留学居住人格测试（独立引流入口 /ryugaku、canonical 统一到此）
  const ryugaku: MetadataRoute.Sitemap = [
    {
      url: `${base}/ryugaku`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // 駅ページ + 区市 hub（ja 専用、hreflang 無し）。lastmod はデータ基準日
  //（build 時刻だと毎デプロイで全頁更新扱いになり信号が薄まる）。
  const { list, wards, dataDate } = await loadStationPages()
  const stationDataDate = new Date(dataDate)
  const areaPages: MetadataRoute.Sitemap = [
    { url: `${base}/area`, lastModified: stationDataDate, changeFrequency: 'monthly', priority: 0.7 },
    ...wards.map(w => ({
      url: `${base}/area/${w.slug}`,
      lastModified: stationDataDate,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
  const stationPages: MetadataRoute.Sitemap = list.map(s => ({
    url: `${base}/st/${s.slug}`,
    lastModified: stationDataDate,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...main, ...ryugaku, ...toHub, ...areaPages, ...stationPages, ...destinations, ...legal]
}
