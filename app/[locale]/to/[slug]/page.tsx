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
import ToActionButtons from './ToActionButtons'

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

const loadDestinationV2 = cache(async (slug: string): Promise<V2Content | null> => {
  const filePath = path.join(
    process.cwd(),
    'public/data/destinations_v2',
    `${slug}.json`,
  )
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as V2Content
  } catch {
    return null
  }
})

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
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (!isFixedDestination(slug)) return {}
  const meta = DESTINATIONS_META.find(m => m.slug === slug)!
  const title = `${meta.displayName}への通勤時間地図`
  const description = `${meta.displayName} を通勤先とした東京圏 1843 駅の通勤時間地図。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、${meta.displayName} 通勤に合う街を探す。`
  return {
    title,
    description,
    alternates: { canonical: `/to/${slug}` },
    openGraph: {
      title: `${title} | Kayoha`,
      description,
      url: `/to/${slug}`,
      type: 'website',
      siteName: 'Kayoha',
      locale: 'ja_JP',
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
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!isFixedDestination(slug)) notFound()
  const meta = DESTINATIONS_META.find(m => m.slug === slug)!
  const [allStats, content] = await Promise.all([
    loadStats(),
    loadDestinationV2(slug),
  ])
  const stats = allStats[slug]
  const others = DESTINATIONS_META.filter(m => m.slug !== slug)

  const fallbackDescription =
    `${meta.displayName} を通勤先として街選びをする人のための地図ページです。Kayoha では東京圏 1843 駅それぞれから ${meta.displayName} までの通勤時間を実際の GTFS 時刻表で算出し、5 分刻みのカラーリングで一目で読める形に整理しています。家賃の目安、周辺エリアの特徴、コミュニティの評価をあわせて確認しながら、自分に合う街を地図上で探してください。`

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${meta.displayName}への通勤時間地図 | Kayoha`,
    url: `https://kayoha.com/to/${slug}`,
    inLanguage: 'ja-JP',
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
            {meta.displayName}への通勤時間地図
          </h1>
          <p className="font-shippori text-base md:text-lg text-ed-ink/70 italic">
            次の駅で、暮らしをめくる。
          </p>
        </header>

        <section className="mb-12 md:mb-16 grid grid-cols-3 gap-4 md:gap-8 border-y border-ed-ink/10 py-8">
          <StatBlock label="30 分以内" value={String(stats.within30)} unit="駅" />
          <StatBlock label="45 分以内" value={String(stats.within45)} unit="駅" />
          <StatBlock
            label="平均家賃目安"
            value={stats.avgRent > 0 ? stats.avgRent.toFixed(1) : '—'}
            unit={stats.avgRent > 0 ? '万円' : ''}
          />
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
          <ToActionButtons slug={meta.slug} displayName={meta.displayName} />
        </section>

        {content?.faq && content.faq.length > 0 && (
          <section className="mb-16 md:mb-20 border-t border-ed-ink/10 pt-12 md:pt-16">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-8 md:mb-10 text-center">
              よくある質問
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
            最終更新 · {content.last_updated}
          </p>
        )}

        <section className="border-t border-ed-ink/10 pt-12">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            他の主要駅から探す
          </h2>
          <ul className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3 font-shippori text-sm md:text-base text-center">
            {others.map(m => (
              <li key={m.slug}>
                <Link
                  href={`/to/${m.slug}`}
                  className="text-ed-ink/75 hover:text-ed-accent transition-colors"
                >
                  {m.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 md:mt-32 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href="/" className="hover:text-ed-ink/80 transition-colors">
            Top
          </Link>
          <Link href="/legal" className="hover:text-ed-ink/80 transition-colors">
            運営情報
          </Link>
          <Link href="/legal/privacy" className="hover:text-ed-ink/80 transition-colors">
            プライバシー
          </Link>
          <Link href="/legal/ads" className="hover:text-ed-ink/80 transition-colors">
            広告について
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
