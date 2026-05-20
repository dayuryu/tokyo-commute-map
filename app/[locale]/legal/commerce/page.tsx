import type { Metadata } from 'next'
import { getSiteInfo } from '@/lib/site-info'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | Kayoha',
  description: 'Kayoha（通葉）の特定商取引法に基づく表記。',
}

export default function CommercePage() {
  const site = getSiteInfo()

  const rows: { k: string; v: React.ReactNode }[] = [
    { k: 'サイト名',       v: `${site.siteName}（${site.siteNameJa}）` },
    { k: 'URL',           v: <a href={site.siteUrl} className="underline">{site.siteUrl}</a> },
    { k: '運営者',         v: site.operatorName },
    { k: '所在地',         v: site.operatorAddress },
    { k: '電話番号',       v: site.operatorPhone },
    { k: '連絡先メール',   v: <a href={`mailto:${site.contactEmail}`} className="underline">{site.contactEmail}</a> },
    {
      k: '提供役務',
      v: '鉄道駅情報の閲覧、コミュニティ評価の閲覧および投稿（無料）',
    },
    { k: '役務の対価',     v: '無料（運営費は広告収益により賄われます）' },
    { k: '支払方法・時期', v: '該当なし（無償役務のため）' },
    { k: '役務の提供時期', v: 'お申込み完了後、即時' },
    {
      k: '返品・キャンセル',
      v: '無償役務のため返品・キャンセルの概念は適用されません。',
    },
    {
      k: '動作環境',
      v: 'Chrome / Safari / Firefox / Edge 各最新版。モバイル端末は iOS 16 以降 / Android 10 以降推奨。',
    },
  ]

  return (
    <article className="fade-up">
      <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
        特定商取引法に基づく表記
      </h1>
      <p className="text-sp-ink-soft text-sm leading-relaxed mb-10">
        当サイトは無償の情報提供サービスです。特定商取引に関する法律に基づき、運営者情報を以下のとおり開示します。
      </p>

      <dl className="divide-y divide-sp-ink-soft/15 border-y border-sp-ink-soft/15">
        {rows.map(row => (
          <div
            key={row.k}
            className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-1 md:gap-6 py-4"
          >
            <dt className="text-sm font-semibold text-sp-ink">{row.k}</dt>
            <dd className="text-sm text-sp-txt leading-relaxed">{row.v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10 text-xs text-sp-ink-soft/80 leading-relaxed space-y-2">
        <p>
          ※「所在地」「電話番号」については、消費者庁ガイドラインに基づき、ご請求があった場合に遅滞なく開示します。
        </p>
        <p>
          ※当サイトはアフィリエイト広告を掲載していますが、商品・サービスの販売主体は各広告主であり、当サイトは情報提供のみを行っています。
        </p>
      </section>
    </article>
  )
}
