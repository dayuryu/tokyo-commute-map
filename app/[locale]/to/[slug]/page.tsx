import type { Metadata } from 'next'
import Link from 'next/link'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  DESTINATIONS_META,
  isFixedDestination,
  type FixedDestination,
} from '@/lib/destinations'
import { staticMessages, fillMessage, localeHref } from '@/lib/static-messages'
import ToActionButtons from './ToActionButtons'

/** locale 別の目的地表示名（en はローマ字、ja / zh は漢字のまま）。 */
function destDisplayName(meta: (typeof DESTINATIONS_META)[number], locale: string) {
  return locale === 'en' ? meta.displayNameEn : meta.displayName
}

type DestStats = {
  within30: number
  within45: number
  avgRent: number
}

type V2Content = {
  slug: string
  displayName: string
  last_updated: string
  intro: string
  faq: { q: string; a: string }[]
}

// zh / en は public/data/destinations_v2/{locale}/{slug}.json を先に探し、
// 未翻訳の駅は ja 原文（root 直下）に graceful fallback する。
const loadDestinationV2 = cache(
  async (slug: string, locale: string): Promise<V2Content | null> => {
    const candidates =
      locale === 'ja'
        ? [`${slug}.json`]
        : [`${locale}/${slug}.json`, `${slug}.json`]
    for (const rel of candidates) {
      try {
        const raw = await fs.readFile(
          path.join(process.cwd(), 'public/data/destinations_v2', rel),
          'utf-8',
        )
        return JSON.parse(raw) as V2Content
      } catch {
        // 次の候補へ
      }
    }
    return null
  },
)

const loadStats = cache(async (): Promise<Record<FixedDestination, DestStats>> => {
  const geojsonPath = path.join(process.cwd(), 'public/data/stations.geojson')
  const rentPath = path.join(process.cwd(), 'public/data/station_government_rent.json')
  const [geoRaw, rentRaw] = await Promise.all([
    fs.readFile(geojsonPath, 'utf-8'),
    fs.readFile(rentPath, 'utf-8'),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geo = JSON.parse(geoRaw) as { features: any[] }
  const rent = JSON.parse(rentRaw) as { stations: Record<string, number> }

  const stats = {} as Record<FixedDestination, DestStats>
  for (const meta of DESTINATIONS_META) {
    let within30 = 0
    let within45 = 0
    const rents: number[] = []
    for (const f of geo.features) {
      const min = f.properties[`min_to_${meta.slug}`]
      if (typeof min !== 'number') continue
      if (min <= 30) within30 += 1
      if (min <= 45) {
        within45 += 1
        const r = rent.stations[String(f.properties.code)]
        if (typeof r === 'number') rents.push(r / 10000)
      }
    }
    const avgRent = rents.length
      ? rents.reduce((a, b) => a + b, 0) / rents.length
      : 0
    stats[meta.slug] = { within30, within45, avgRent }
  }
  return stats
})

export async function generateStaticParams() {
  return DESTINATIONS_META.map(m => ({ slug: m.slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isFixedDestination(slug)) return {}
  const meta = DESTINATIONS_META.find(m => m.slug === slug)!
  const t = staticMessages(locale).toLanding
  const name = destDisplayName(meta, locale)
  const title = fillMessage(t.title, { name })
  const description = fillMessage(t.metaDescription, { name })
  const ogLocale = locale === 'zh' ? 'zh_CN' : locale === 'en' ? 'en_US' : 'ja_JP'
  return {
    title,
    description,
    alternates: {
      // x-default (ja URL) に canonical を統一（layout の戦略と同一）。
      // 言語別ターゲティングは hreflang alternates で伝える。
      canonical: `/to/${slug}`,
      languages: {
        ja: `/to/${slug}`,
        zh: `/zh/to/${slug}`,
        en: `/en/to/${slug}`,
        'x-default': `/to/${slug}`,
      },
    },
    openGraph: {
      title: `${title} | Kayoha`,
      description,
      url: localeHref(locale, `/to/${slug}`),
      type: 'website',
      siteName: 'Kayoha',
      locale: ogLocale,
      images: [
        {
          url: '/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Kayoha`,
      description,
      images: ['/opengraph-image.png'],
    },
  }
}

export default async function ToDestinationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isFixedDestination(slug)) notFound()
  const meta = DESTINATIONS_META.find(m => m.slug === slug)!
  const [allStats, content] = await Promise.all([
    loadStats(),
    loadDestinationV2(slug, locale),
  ])
  const stats = allStats[slug]
  const others = DESTINATIONS_META.filter(m => m.slug !== slug)

  const messages = staticMessages(locale)
  const t = messages.toLanding
  const name = destDisplayName(meta, locale)
  const pageTitle = fillMessage(t.title, { name })
  const fallbackDescription = fillMessage(t.fallbackDescription, { name })

  // 家賃目安: ja / zh は「9.2 万円 / 万日元」、en は「¥92k」表記。
  const rentValue =
    stats.avgRent > 0
      ? locale === 'en'
        ? `¥${Math.round(stats.avgRent * 10)}k`
        : stats.avgRent.toFixed(1)
      : '—'
  const rentUnit = stats.avgRent > 0 ? t.unitRent : ''

  const jsonLdLang = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP'
  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${pageTitle} | Kayoha`,
    url: `https://kayoha.com${localeHref(locale, `/to/${slug}`)}`,
    inLanguage: jsonLdLang,
    isPartOf: { '@id': 'https://kayoha.com/#website' },
    about: {
      '@type': 'Place',
      name: meta.displayName,
      address: { '@type': 'PostalAddress', addressCountry: 'JP' },
    },
  }

  const faqJsonLd = content?.faq && content.faq.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: content.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }
    : null

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <header className="mb-12 md:mb-16 text-center">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            Commute Map
          </p>
          <h1 className="font-shippori text-3xl md:text-5xl font-medium text-ed-ink mb-4 leading-tight">
            {pageTitle}
          </h1>
          <p className="font-shippori text-base md:text-lg text-ed-ink/70 italic">
            {messages.welcome.tagline}
          </p>
        </header>

        <section className="mb-12 md:mb-16 grid grid-cols-3 gap-4 md:gap-8 border-y border-ed-ink/10 py-8">
          <StatBlock label={t.stat30} value={String(stats.within30)} unit={t.unitStations} />
          <StatBlock label={t.stat45} value={String(stats.within45)} unit={t.unitStations} />
          <StatBlock label={t.statRent} value={rentValue} unit={rentUnit} />
        </section>

        <section className="mb-16 md:mb-20">
          {content?.intro ? (
            <div className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85
              [&_p]:mb-6
              [&_p:last-child]:mb-0
              [&_strong]:font-medium [&_strong]:text-ed-ink
              [&_table]:my-8 [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
              [&_thead]:border-b [&_thead]:border-ed-ink/30
              [&_th]:text-left [&_th]:font-medium [&_th]:py-3 [&_th]:px-2 [&_th]:text-ed-ink
              [&_tbody_tr]:border-b [&_tbody_tr]:border-ed-ink/10
              [&_td]:py-3 [&_td]:px-2 [&_td]:align-top">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content.intro}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85">
              {fallbackDescription}
            </p>
          )}
        </section>

        <section className="mb-16 md:mb-24">
          <ToActionButtons
            slug={meta.slug}
            homeHref={localeHref(locale, '/')}
            labelMap={t.ctaMap}
            labelAi={fillMessage(t.ctaAi, { name })}
          />
        </section>

        {content?.faq && content.faq.length > 0 && (
          <section className="mb-16 md:mb-20 border-t border-ed-ink/10 pt-12 md:pt-16">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-8 md:mb-10 text-center">
              {t.faqTitle}
            </h2>
            <dl className="space-y-8 md:space-y-10">
              {content.faq.map((item, i) => (
                <div key={i}>
                  <dt className="font-shippori text-base md:text-lg font-medium text-ed-ink mb-3 leading-snug">
                    Q. {item.q}
                  </dt>
                  <dd className="font-shippori text-sm md:text-base text-ed-ink/85 leading-loose pl-5">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {content?.last_updated && (
          <p className="text-center font-cormorant text-xs uppercase tracking-[0.25em] text-ed-ink/45 mb-12">
            {t.lastUpdated} · {content.last_updated}
          </p>
        )}

        <section className="border-t border-ed-ink/10 pt-12">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            {t.othersTitle}
          </h2>
          <ul className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3 font-shippori text-sm md:text-base text-center">
            {others.map(m => (
              <li key={m.slug}>
                <Link
                  href={localeHref(locale, `/to/${m.slug}`)}
                  className="text-ed-ink/75 hover:text-ed-accent transition-colors"
                >
                  {destDisplayName(m, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 md:mt-32 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href={localeHref(locale, '/')} className="hover:text-ed-ink/80 transition-colors">
            {t.footerTop}
          </Link>
          <Link href={localeHref(locale, '/legal')} className="hover:text-ed-ink/80 transition-colors">
            {t.footerLegal}
          </Link>
          <Link href={localeHref(locale, '/legal/privacy')} className="hover:text-ed-ink/80 transition-colors">
            {t.footerPrivacy}
          </Link>
          <Link href={localeHref(locale, '/legal/ads')} className="hover:text-ed-ink/80 transition-colors">
            {t.footerAds}
          </Link>
        </footer>
      </article>
    </main>
  )
}

function StatBlock({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <p className="font-cormorant text-xs uppercase tracking-[0.25em] text-ed-ink/55 mb-2">
        {label}
      </p>
      <p className="font-shippori text-2xl md:text-3xl text-ed-ink leading-none">
        <span className="font-medium">{value}</span>
        {unit && <span className="text-base md:text-lg text-ed-ink/70 ml-1">{unit}</span>}
      </p>
    </div>
  )
}
