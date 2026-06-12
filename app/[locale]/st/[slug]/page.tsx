import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadStationPages, type StationPage } from '@/lib/station-pages/data'

// 駅ページ（駅別住みやすさ）— 設計: docs/station-pages-design.md
// ja 専用（対象クエリが日本語のみのため。canonical 自指、hreflang 無し）。
// 通勤マトリクス表（GTFS 実算、競合に無い独有データ）を主役に、
// 編集文 + データ注入 FAQ で独特内容比を確保する（scaled content 対策）。

// ja のみ生成（bottom-up で locale ごと完全な組を返す。dynamicParams=false で
// /zh/st/* 等は 404）。親 params を受けて絞る書き方は頁が生成されないので不可。
export async function generateStaticParams() {
  const { list } = await loadStationPages()
  return list.map(s => ({ locale: 'ja', slug: s.slug }))
}

export const dynamicParams = false

const yen = (v: number) => (v / 10000).toFixed(1)

/** 答案優先の冒頭文（GEO: AI に摘録される直答形）。データ揃いで文形が変わる */
function leadText(s: StationPage): string {
  const [c1, c2] = s.commutes
  const parts: string[] = []
  if (c1) {
    parts.push(
      `${s.displayName}駅から${c1.name}までは実時刻表ベースの最短で約${c1.minutes}分` +
        (c2 ? `、${c2.name}までは約${c2.minutes}分` : '') +
        '。',
    )
  }
  if (s.govRent) parts.push(`家賃相場は政府住宅統計ベースで月あたり約${yen(s.govRent)}万円。`)
  if (s.lines.length > 0)
    parts.push(`${s.lines.slice(0, 3).join('・')}${s.lines.length > 3 ? `など ${s.lines.length} 路線` : ''}が利用できる。`)
  return parts.join('')
}

function faqItems(s: StationPage): { q: string; a: string }[] {
  const items: { q: string; a: string }[] = []
  const c1 = s.commutes[0]
  if (c1) {
    items.push({
      q: `${s.displayName}駅から${c1.name}まで何分かかりますか？`,
      a:
        `GTFS 実時刻表ベースの算出で最短約${c1.minutes}分です` +
        (c1.transfers !== null ? `（乗換 ${c1.transfers} 回）` : '') +
        '。時間帯により前後します。',
    })
  }
  if (s.govRent) {
    let a = `政府住宅統計ベースで月あたり約${yen(s.govRent)}万円が目安です。`
    if (s.suumoRent?.['1R'])
      a += `SUUMO 集計の駅近物件では 1R 約${s.suumoRent['1R']}万円${s.suumoRent['1LDK'] ? `、1LDK 約${s.suumoRent['1LDK']}万円` : ''}です。`
    items.push({ q: `${s.displayName}駅周辺の家賃相場はいくらですか？`, a })
  }
  if (s.lines.length > 0) {
    items.push({
      q: `${s.displayName}駅にはどの路線が乗り入れていますか？`,
      a: `${s.lines.join('、')}が利用できます。`,
    })
  }
  const desc = s.description ?? s.feature
  if (desc) items.push({ q: `${s.displayName}駅周辺はどんな街ですか？`, a: desc })
  return items
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { bySlug } = await loadStationPages()
  const s = bySlug[slug]
  if (!s) return {}
  const title = `${s.displayName}駅の住みやすさ・家賃相場・通勤時間データ`
  const description = leadText(s).slice(0, 110) + '主要 30 通勤地への所要時間を実データで一覧。'
  return {
    title,
    description,
    alternates: { canonical: `/st/${s.slug}` },
    openGraph: {
      title: `${title} | Kayoha`,
      description,
      url: `/st/${s.slug}`,
      type: 'website',
      siteName: 'Kayoha',
      locale: 'ja_JP',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: title }],
    },
  }
}

export default async function StationPageView({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug } = await params
  const { bySlug, dataDate } = await loadStationPages()
  const s = bySlug[slug]
  if (!s) notFound()

  const lead = leadText(s)
  const faq = faqItems(s)
  const within30 = s.commutes.filter(c => c.minutes <= 30).length
  const desc = s.description ?? s.feature
  const mapHref = `/?rstations=${encodeURIComponent(s.name)}&rc=a8332b`

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'TrainStation',
      name: `${s.displayName}駅`,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'JP',
        ...(s.muni.pref ? { addressRegion: s.muni.pref } : {}),
        ...(s.muni.city ? { addressLocality: s.muni.city } : {}),
      },
      geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kayoha', item: 'https://kayoha.com/' },
        ...(s.ward
          ? [{ '@type': 'ListItem', position: 2, name: `${s.ward.name}の住みやすさ`, item: `https://kayoha.com/area/${s.ward.slug}` }]
          : []),
        { '@type': 'ListItem', position: s.ward ? 3 : 2, name: `${s.displayName}駅の住みやすさ` },
      ],
    },
    ...(faq.length > 0
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        }]
      : []),
  ]

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg" lang="ja">
      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        {/* パンくず（可視、JSON-LD と対応） */}
        <nav className="mb-8 text-xs text-ed-ink/50 font-shippori">
          <Link href="/" className="hover:text-ed-ink/80">Kayoha</Link>
          {s.ward && (
            <>
              <span className="mx-2">›</span>
              <Link href={`/area/${s.ward.slug}`} className="hover:text-ed-ink/80">{s.ward.name}</Link>
            </>
          )}
          <span className="mx-2">›</span>
          <span>{s.displayName}駅</span>
        </nav>

        <header className="mb-10 md:mb-14">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            Station Guide
          </p>
          <h1 className="font-shippori text-3xl md:text-4xl font-medium text-ed-ink mb-5 leading-tight">
            {s.displayName}駅の住みやすさ
            <span className="block mt-2 text-lg md:text-xl text-ed-ink/60">家賃相場と通勤時間をデータで見る</span>
          </h1>
          {/* 答案優先リード（GEO 摘録対象） */}
          <p className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85">{lead}</p>
        </header>

        <section className="mb-12 md:mb-16 grid grid-cols-3 gap-4 md:gap-8 border-y border-ed-ink/10 py-8">
          <Stat label={`${s.commutes[0]?.name ?? '—'}まで`} value={s.commutes[0] ? String(s.commutes[0].minutes) : '—'} unit="分" />
          <Stat label="30 分以内の通勤地" value={String(within30)} unit={`/ ${s.commutes.length}`} />
          <Stat label="家賃相場" value={s.govRent ? yen(s.govRent) : '—'} unit={s.govRent ? '万円' : ''} />
        </section>

        {/* 通勤マトリクス（独有データの主役） */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            主要 30 通勤地への所要時間
          </h2>
          <table className="w-full text-sm font-shippori border-collapse">
            <caption className="caption-bottom pt-3 text-xs text-ed-ink/45">
              GTFS 実時刻表ベースの最短所要時間（データ基準 {dataDate}）。時間帯により前後します。
            </caption>
            <thead className="border-b border-ed-ink/30">
              <tr>
                <th scope="col" className="text-left font-medium py-2.5 px-2 text-ed-ink">通勤先</th>
                <th scope="col" className="text-right font-medium py-2.5 px-2 text-ed-ink">所要時間</th>
                <th scope="col" className="text-right font-medium py-2.5 px-2 text-ed-ink">乗換</th>
              </tr>
            </thead>
            <tbody>
              {s.commutes.map(c => (
                <tr key={c.slug} className={`border-b border-ed-ink/10 ${c.minutes <= 30 ? 'bg-ed-ink/[.035]' : ''}`}>
                  <td className="py-2.5 px-2">
                    <Link href={`/to/${c.slug}`} className="text-ed-ink/85 hover:text-ed-accent transition-colors">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    <span className={c.minutes <= 30 ? 'font-medium text-ed-ink' : 'text-ed-ink/75'}>{c.minutes} 分</span>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-ed-ink/60">
                    {c.transfers !== null ? `${c.transfers} 回` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 家賃 */}
        {(s.govRent || s.suumoRent) && (
          <section className="mb-14 md:mb-20">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
              家賃相場
            </h2>
            {s.govRent && (
              <p className="font-shippori text-base leading-loose text-ed-ink/85 mb-5">
                政府住宅統計（e-Stat）ベースの目安は月あたり約 {yen(s.govRent)} 万円。
              </p>
            )}
            {s.suumoRent && (
              <div className="flex flex-wrap gap-x-8 gap-y-2 font-shippori text-sm text-ed-ink/80">
                {Object.entries(s.suumoRent)
                  .filter(([k, v]) => k !== 'category' && typeof v === 'number')
                  .map(([k, v]) => (
                    <span key={k}>
                      <span className="text-ed-ink/55 mr-1.5">{k}</span>
                      <span className="tabular-nums font-medium text-ed-ink">{v} 万円</span>
                    </span>
                  ))}
                <span className="w-full text-xs text-ed-ink/45 mt-1">SUUMO 駅別賃料相場（駅徒歩 5 分以内・新築、{dataDate} 時点）</span>
              </div>
            )}
          </section>
        )}

        {/* 街の特徴（編集文。未生成は area_features を fallback 表示） */}
        {desc && (
          <section className="mb-14 md:mb-20">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
              {s.displayName}駅周辺はどんな街か
            </h2>
            <p className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85">{desc}</p>
          </section>
        )}

        {/* 隣の駅 */}
        {s.neighbors.length > 0 && (
          <section className="mb-14 md:mb-20">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
              隣の駅と比べる
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 font-shippori text-sm">
              {s.neighbors.map(n => (
                <li key={n.code} className="border border-ed-ink/10 rounded-lg px-4 py-3 text-center">
                  {n.hasPage ? (
                    <Link href={`/st/${n.slug}`} className="text-ed-ink hover:text-ed-accent transition-colors font-medium">
                      {n.name}
                    </Link>
                  ) : (
                    <span className="text-ed-ink/75">{n.name}</span>
                  )}
                  <span className="block text-xs text-ed-ink/50 mt-1">電車 {n.minutes} 分</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 似た駅 */}
        {s.similar.length > 0 && (
          <section className="mb-14 md:mb-20">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
              通勤・家賃が似ている駅
            </h2>
            <ul className="flex flex-wrap justify-center gap-3 font-shippori text-sm">
              {s.similar.map(n => (
                <li key={n.code}>
                  <Link
                    href={`/st/${n.slug}`}
                    className="inline-block border border-ed-ink/15 rounded-full px-5 py-2 text-ed-ink/80 hover:text-ed-accent hover:border-ed-accent/40 transition-colors"
                  >
                    {n.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <section className="mb-14 md:mb-20 text-center">
          <a
            href={mapHref}
            className="inline-block font-shippori text-base font-medium text-white bg-ed-accent rounded-full px-8 py-4 shadow-md hover:opacity-90 transition-opacity"
          >
            地図で{s.displayName}駅周辺の通勤時間を見る →
          </a>
          <p className="mt-3 text-xs text-ed-ink/50">東京圏 1831 駅の通勤時間マップ（無料）</p>
        </section>

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="mb-14 md:mb-20 border-t border-ed-ink/10 pt-12">
            <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-8 text-center">
              よくある質問
            </h2>
            <dl className="space-y-7">
              {faq.map((item, i) => (
                <div key={i}>
                  <dt className="font-shippori text-base font-medium text-ed-ink mb-2 leading-snug">Q. {item.q}</dt>
                  <dd className="font-shippori text-sm md:text-base text-ed-ink/85 leading-loose pl-5">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <footer className="mt-16 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href="/" className="hover:text-ed-ink/80 transition-colors">Top</Link>
          {s.ward && (
            <Link href={`/area/${s.ward.slug}`} className="hover:text-ed-ink/80 transition-colors">
              {s.ward.name}の駅一覧
            </Link>
          )}
          <Link href="/to" className="hover:text-ed-ink/80 transition-colors">通勤先ガイド</Link>
          <Link href="/legal" className="hover:text-ed-ink/80 transition-colors">運営情報</Link>
        </footer>
      </article>
    </main>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <p className="font-cormorant text-xs uppercase tracking-[0.25em] text-ed-ink/55 mb-2">{label}</p>
      <p className="font-shippori text-2xl md:text-3xl text-ed-ink leading-none">
        <span className="font-medium">{value}</span>
        {unit && <span className="text-base md:text-lg text-ed-ink/70 ml-1">{unit}</span>}
      </p>
    </div>
  )
}
