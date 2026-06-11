import type { Metadata } from 'next'
import Link from 'next/link'
import { DESTINATIONS_META, destinationLabel } from '@/lib/destinations'
import { loadDestinationStats } from '@/lib/destination-stats'
import { staticMessages, localeHref } from '@/lib/static-messages'

// 通勤先ガイド hub — 30 駅個別頁への internal link 集約点（SEO: 準孤児頁解消）。
// HeaderMenu（全頁）→ /to → 30 駅、のリンク木を成立させる。

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = staticMessages(locale).toIndex
  const ogLocale = locale === 'zh' ? 'zh_CN' : locale === 'en' ? 'en_US' : 'ja_JP'
  return {
    title: t.title,
    description: t.metaDescription,
    alternates: {
      canonical: '/to',
      languages: {
        ja: '/to',
        zh: '/zh/to',
        en: '/en/to',
        'x-default': '/to',
      },
    },
    openGraph: {
      title: `${t.title} | Kayoha`,
      description: t.metaDescription,
      url: localeHref(locale, '/to'),
      type: 'website',
      siteName: 'Kayoha',
      locale: ogLocale,
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: t.title }],
    },
  }
}

export default async function ToIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const stats = await loadDestinationStats()
  const messages = staticMessages(locale)
  const t = messages.toIndex
  const tl = messages.toLanding

  const jsonLdLang = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP'
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t.title} | Kayoha`,
    url: `https://kayoha.com${localeHref(locale, '/to')}`,
    inLanguage: jsonLdLang,
    isPartOf: { '@id': 'https://kayoha.com/#website' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: DESTINATIONS_META.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: destinationLabel(m, locale),
        url: `https://kayoha.com${localeHref(locale, `/to/${m.slug}`)}`,
      })),
    },
  }

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <header className="mb-12 md:mb-16 text-center">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            Commute Map
          </p>
          <h1 className="font-shippori text-3xl md:text-4xl font-medium text-ed-ink mb-4 leading-tight">
            {t.title}
          </h1>
          <p className="font-shippori text-base md:text-lg text-ed-ink/70">
            {t.lead}
          </p>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 border-t border-ed-ink/10">
          {DESTINATIONS_META.map(m => {
            const s = stats[m.slug]
            const rent =
              s.avgRent > 0
                ? locale === 'en'
                  ? `¥${Math.round(s.avgRent * 10)}k`
                  : `${s.avgRent.toFixed(1)}${tl.unitRent}`
                : null
            return (
              <li key={m.slug} className="border-b border-ed-ink/10">
                <Link
                  href={localeHref(locale, `/to/${m.slug}`)}
                  className="flex items-baseline justify-between gap-4 py-4 group"
                >
                  <span className="font-shippori text-lg text-ed-ink group-hover:text-ed-accent transition-colors">
                    {destinationLabel(m, locale)}
                  </span>
                  <span className="font-shippori text-xs text-ed-ink/55 text-right leading-relaxed">
                    {tl.stat30} {s.within30} {tl.unitStations}
                    {rent && <span className="block">{tl.statRent} {rent}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        <footer className="mt-20 md:mt-28 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href={localeHref(locale, '/')} className="hover:text-ed-ink/80 transition-colors">
            {tl.footerTop}
          </Link>
          <Link href={localeHref(locale, '/legal')} className="hover:text-ed-ink/80 transition-colors">
            {tl.footerLegal}
          </Link>
          <Link href={localeHref(locale, '/legal/privacy')} className="hover:text-ed-ink/80 transition-colors">
            {tl.footerPrivacy}
          </Link>
          <Link href={localeHref(locale, '/legal/ads')} className="hover:text-ed-ink/80 transition-colors">
            {tl.footerAds}
          </Link>
        </footer>
      </div>
    </main>
  )
}
