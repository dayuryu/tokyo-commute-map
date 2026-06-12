import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadStationPages } from '@/lib/station-pages/data'

// エリア索引 — 区市 hub への入口（HeaderMenu / footer から内链される）。ja 専用。


export const metadata: Metadata = {
  title: 'エリアから住む街を探す — 23 区・主要都市の駅別データ',
  description:
    '東京 23 区と首都圏主要都市について、駅ごとの通勤時間・家賃相場データで住みやすさを比較。エリアを選んで駅別ガイドへ。',
  alternates: { canonical: '/area' },
  openGraph: {
    title: 'エリアから住む街を探す | Kayoha',
    description:
      '東京 23 区と首都圏主要都市について、駅ごとの通勤時間・家賃相場データで住みやすさを比較。',
    url: '/area',
    type: 'website',
    siteName: 'Kayoha',
    locale: 'ja_JP',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'エリアから住む街を探す' }],
  },
}

export default async function AreaIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // 日本語専用（駅頁工程は ja クエリのみ対象）。他 locale は 404
  const { locale } = await params
  if (locale !== 'ja') notFound()
  const { wards } = await loadStationPages()
  const tokyo23 = wards.filter(w => w.slug.endsWith('-ku'))
  const cities = wards.filter(w => w.slug.endsWith('-shi'))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'エリアから住む街を探す | Kayoha',
    url: 'https://kayoha.com/area',
    inLanguage: 'ja-JP',
    isPartOf: { '@id': 'https://kayoha.com/#website' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: wards.map((w, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: w.name,
        url: `https://kayoha.com/area/${w.slug}`,
      })),
    },
  }

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg" lang="ja">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <header className="mb-12 md:mb-16 text-center">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            Area Guide
          </p>
          <h1 className="font-shippori text-3xl md:text-4xl font-medium text-ed-ink mb-4 leading-tight">
            エリアから住む街を探す
          </h1>
          <p className="font-shippori text-base md:text-lg text-ed-ink/70">
            エリアを選ぶと、駅ごとの通勤時間・家賃相場のデータ比較と駅別ガイドが見られます。
          </p>
        </header>

        <WardGrid title="東京 23 区" wards={tokyo23} />
        <WardGrid title="主要都市" wards={cities} />

        <footer className="mt-20 md:mt-28 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href="/" className="hover:text-ed-ink/80 transition-colors">Top</Link>
          <Link href="/to" className="hover:text-ed-ink/80 transition-colors">通勤先ガイド</Link>
          <Link href="/legal" className="hover:text-ed-ink/80 transition-colors">運営情報</Link>
        </footer>
      </div>
    </main>
  )
}

function WardGrid({ title, wards }: { title: string; wards: { slug: string; name: string; pageCount: number }[] }) {
  if (wards.length === 0) return null
  return (
    <section className="mb-12">
      <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">{title}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 border-t border-ed-ink/10">
        {wards.map(w => (
          <li key={w.slug} className="border-b border-ed-ink/10">
            <Link href={`/area/${w.slug}`} className="flex items-baseline justify-between py-3.5 group">
              <span className="font-shippori text-base text-ed-ink group-hover:text-ed-accent transition-colors">{w.name}</span>
              <span className="font-shippori text-xs text-ed-ink/50">{w.pageCount} 駅</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
