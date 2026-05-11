import type { Metadata } from 'next'
import { getSiteInfo, LAST_UPDATED } from '@/lib/site-info'

export const metadata: Metadata = {
  title: '広告表示について | 東京圏通勤マップ',
  description: '景品表示法（ステルスマーケティング規制）に基づくアフィリエイト広告の表示方針。',
}

export default function AdsPage() {
  const site = getSiteInfo()

  return (
    <article className="fade-up space-y-10">
      <header>
        <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
          広告表示について
        </h1>
        <p className="text-sm leading-relaxed text-sp-ink-soft">
          {site.siteName}（以下「当サイト」）には、第三者によるアフィリエイト広告が含まれています。景品表示法に基づくステルスマーケティング規制（2023 年 10 月 1 日施行）に従い、広告であることを明示します。
        </p>
      </header>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">1. 利用しているアフィリエイトプログラム</h2>
        <ul className="space-y-2">
          {site.affiliatePartners.map(p => (
            <li
              key={p.name}
              className="border border-sp-ink-soft/15 rounded-lg px-4 py-3 text-sm leading-relaxed"
            >
              <div className="font-semibold text-sp-ink">{p.name}</div>
              <div className="text-sp-ink-soft">運営: {p.operator}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">2. 広告の表示について</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-2">
          当サイト内に表示されるリンクのうち、以下のいずれかに該当するものはアフィリエイト広告です：
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed space-y-1 text-sp-txt">
          <li>「PR」または「広告」と明示的に表記されているリンク</li>
          <li>上記第 1 項に記載のアフィリエイトプロバイダのドメインを経由するリンク</li>
        </ul>
        <p className="text-sm leading-relaxed text-sp-txt mt-3">
          利用者が当該リンクをクリックし、リンク先で商品・サービスを購入・申込した場合、当サイトに紹介報酬が支払われることがあります。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">3. 商品・サービスの内容について</h2>
        <p className="text-sm leading-relaxed text-sp-txt">
          リンク先で掲載されている商品・サービスの価格・仕様・在庫状況等は、各事業者の判断により予告なく変更される場合があります。
          最新かつ正確な情報については、必ずリンク先の販売事業者のウェブサイトをご確認ください。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">4. 通勤時間データの精度について</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-2">
          当サイトの通勤時間は、公開されている運行データ（GTFS）および利用者からの訂正報告を基にした<strong className="font-semibold text-sp-ink">推算値</strong>であり、実際の所要時間とは概ね <span className="font-mono-num">±5〜10</span> 分程度の誤差が生じる可能性があります。
        </p>
        <p className="text-sm leading-relaxed text-sp-txt">
          住居選定など重要な意思決定の前には、Yahoo!乗換案内・Google マップ等の公式経路検索サービスにて最新の情報をご確認ください。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">5. 景品表示法に基づく表示</h2>
        <p className="text-sm leading-relaxed text-sp-txt">
          2023 年 10 月 1 日施行のステルスマーケティング規制（景品表示法に基づく不当表示規制）に基づき、当サイトは広告掲載箇所において広告であることが明確に判別できるよう表示しています。
        </p>
        <p className="text-sm leading-relaxed text-sp-txt mt-3">
          詳細は{' '}
          <a
            href="https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            消費者庁ガイドライン
          </a>
          {' '}をご参照ください。
        </p>
      </section>

      <p className="text-xs text-sp-ink-soft/80 pt-6 border-t border-sp-ink-soft/15">
        最終更新日: {LAST_UPDATED}
      </p>
    </article>
  )
}
