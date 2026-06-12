import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadStationPages, type WardPage } from '@/lib/station-pages/data'

// 区市 hub — 配下駅ページへの内链中枢 + 「{区名} 住みやすさ」クエリ受け。
// A2 実測: 区級クエリの心智は行政手続のため、タイトルは駅別データで差異化する。

// ja のみ生成（bottom-up 完全組。dynamicParams=false で他 locale は 404）
export async function generateStaticParams() {
  const { wards } = await loadStationPages()
  return wards.map(w => ({ locale: 'ja', ward: w.slug }))
}

export const dynamicParams = false

const yen = (v: number) => (v / 10000).toFixed(1)

function topBy(w: WardPage, key: 'commute' | 'rent') {
  const arr = [...w.stations]
  if (key === 'commute') {
    return arr
      .filter(s => s.commutes[0])
      .sort((a, b) => a.commutes[0].minutes - b.commutes[0].minutes)
      .slice(0, 5)
  }
  return arr
    .filter(s => s.govRent)
    .sort((a, b) => a.govRent! - b.govRent!)
    .slice(0, 5)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; ward: string }>
}): Promise<Metadata> {
  const { ward } = await params
  const { wardBySlug } = await loadStationPages()
  const w = wardBySlug[ward]
  if (!w) return {}
  const title = `${w.name}の住みやすさ・家賃相場【駅別データ】`
  const description = `${w.name}の主要 ${w.pageCount} 駅を通勤時間と家賃相場のデータで比較。駅ごとの 30 通勤地への所要時間・政府統計家賃・街の特徴を一覧できる。`
  return {
    title,
    description,
    alternates: { canonical: `/area/${w.slug}` },
    openGraph: {
      title: `${title} | Kayoha`,
      description,
      url: `/area/${w.slug}`,
      type: 'website',
      siteName: 'Kayoha',
      locale: 'ja_JP',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: title }],
    },
  }
}

export default async function WardPageView({
  params,
}: {
  params: Promise<{ locale: string; ward: string }>
}) {
  const { ward } = await params
  const { wardBySlug } = await loadStationPages()
  const w = wardBySlug[ward]
  if (!w) notFound()

  const fastest = topBy(w, 'commute')
  const cheapest = topBy(w, 'rent')

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${w.name}の住みやすさ・家賃相場【駅別データ】 | Kayoha`,
      url: `https://kayoha.com/area/${w.slug}`,
      inLanguage: 'ja-JP',
      isPartOf: { '@id': 'https://kayoha.com/#website' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: w.stations.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${s.displayName}駅`,
          url: `https://kayoha.com/st/${s.slug}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kayoha', item: 'https://kayoha.com/' },
        { '@type': 'ListItem', position: 2, name: 'エリアから探す', item: 'https://kayoha.com/area' },
        { '@type': 'ListItem', position: 3, name: `${w.name}の住みやすさ` },
      ],
    },
  ]

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg" lang="ja">
      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <nav className="mb-8 text-xs text-ed-ink/50 font-shippori">
          <Link href="/" className="hover:text-ed-ink/80">Kayoha</Link>
          <span className="mx-2">›</span>
          <Link href="/area" className="hover:text-ed-ink/80">エリアから探す</Link>
          <span className="mx-2">›</span>
          <span>{w.name}</span>
        </nav>

        <header className="mb-10 md:mb-14">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            Area Guide
          </p>
          <h1 className="font-shippori text-3xl md:text-4xl font-medium text-ed-ink mb-5 leading-tight">
            {w.name}の住みやすさ
            <span className="block mt-2 text-lg md:text-xl text-ed-ink/60">主要 {w.pageCount} 駅を家賃と通勤時間で比較</span>
          </h1>
          {/* 冒頭リード文（編集文 200-300 字。未生成は出さない） */}
          {w.description && (
            <p className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85 mb-4">
              {w.description}
            </p>
          )}
          <p className={w.description
            ? 'font-shippori text-sm leading-relaxed text-ed-ink/60'
            : 'font-shippori text-base md:text-lg leading-loose text-ed-ink/85'}>
            {w.pref}{w.name}の主要駅について、30 の通勤地への実時刻表ベース所要時間と政府統計の家賃相場をデータで比較できます。駅名から各駅の詳細ガイドへ。
          </p>
        </header>

        {/* データ排行（区ごとに値が変わる独有モジュール） */}
        <section className="mb-12 md:mb-16 grid md:grid-cols-2 gap-8">
          <RankCard
            title="通勤が速い駅 TOP5"
            rows={fastest.map(s => ({
              slug: s.slug,
              name: s.displayName,
              value: `${s.commutes[0].name}まで ${s.commutes[0].minutes} 分`,
            }))}
          />
          <RankCard
            title="家賃が抑えやすい駅 TOP5"
            rows={cheapest.map(s => ({
              slug: s.slug,
              name: s.displayName,
              value: `約 ${yen(s.govRent!)} 万円/月`,
            }))}
          />
        </section>

        {/* 駅一覧表 */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            {w.name}の駅一覧
          </h2>
          <table className="w-full text-sm font-shippori border-collapse">
            <thead className="border-b border-ed-ink/30">
              <tr>
                <th scope="col" className="text-left font-medium py-2.5 px-2 text-ed-ink">駅</th>
                <th scope="col" className="text-right font-medium py-2.5 px-2 text-ed-ink">最速の通勤地</th>
                <th scope="col" className="text-right font-medium py-2.5 px-2 text-ed-ink">家賃相場</th>
              </tr>
            </thead>
            <tbody>
              {w.stations.map(s => (
                <tr key={s.code} className="border-b border-ed-ink/10">
                  <td className="py-2.5 px-2">
                    <Link href={`/st/${s.slug}`} className="text-ed-ink hover:text-ed-accent transition-colors font-medium">
                      {s.displayName}
                    </Link>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-ed-ink/75">
                    {s.commutes[0] ? `${s.commutes[0].name} ${s.commutes[0].minutes} 分` : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-ed-ink/75">
                    {s.govRent ? `${yen(s.govRent)} 万円` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-3 text-xs text-ed-ink/45">
            所要時間は GTFS 実時刻表ベースの最短値、家賃は政府住宅統計ベースの月額目安。
          </p>
        </section>

        <section className="mb-14 text-center">
          <Link
            href="/"
            className="inline-block font-shippori text-base font-medium text-white bg-ed-accent rounded-full px-8 py-4 shadow-md hover:opacity-90 transition-opacity"
          >
            地図で{w.name}の通勤時間を見る →
          </Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href="/" className="hover:text-ed-ink/80 transition-colors">Top</Link>
          <Link href="/area" className="hover:text-ed-ink/80 transition-colors">エリア一覧</Link>
          <Link href="/to" className="hover:text-ed-ink/80 transition-colors">通勤先ガイド</Link>
          <Link href="/legal" className="hover:text-ed-ink/80 transition-colors">運営情報</Link>
        </footer>
      </article>
    </main>
  )
}

function RankCard({ title, rows }: { title: string; rows: { slug: string; name: string; value: string }[] }) {
  return (
    <div className="border border-ed-ink/10 rounded-xl px-6 py-5">
      <h2 className="font-cormorant text-xs uppercase tracking-[0.25em] text-ed-ink/55 mb-4 text-center">{title}</h2>
      <ol className="space-y-2.5 font-shippori text-sm">
        {rows.map((r, i) => (
          <li key={r.slug} className="flex items-baseline gap-3">
            <span className="text-ed-ink/40 tabular-nums w-4">{i + 1}</span>
            <Link href={`/st/${r.slug}`} className="text-ed-ink font-medium hover:text-ed-accent transition-colors">
              {r.name}
            </Link>
            <span className="ml-auto text-ed-ink/60 tabular-nums">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
