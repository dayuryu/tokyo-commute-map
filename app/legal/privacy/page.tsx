import type { Metadata } from 'next'
import Link from 'next/link'
import { getSiteInfo, LAST_UPDATED } from '@/lib/site-info'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | 東京圏通勤マップ',
  description: '東京圏通勤マップにおける個人情報・Cookie の取り扱いについて。',
}

export default function PrivacyPage() {
  const site = getSiteInfo()

  return (
    <article className="fade-up space-y-10">
      <header>
        <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
          プライバシーポリシー
        </h1>
        <p className="text-sp-ink-soft text-sm leading-relaxed">
          {site.siteName}（以下「当サイト」）は、利用者のプライバシーを尊重し、改正個人情報保護法（2022 年 4 月 1 日施行）および関連法令を遵守して個人情報を取り扱います。
        </p>
      </header>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">1. 取得する情報</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed space-y-1 text-sp-txt">
          <li>アクセスログ（IP アドレス、ユーザーエージェント、参照元 URL、リクエスト日時）</li>
          <li>ローカルストレージに保存される閲覧履歴フラグ（初回訪問判定用）</li>
          <li>利用者が任意で投稿する駅評価および通勤時間訂正報告（投稿時に発行される匿名デバイス ID を含む）</li>
          <li>Cookie 経由のセッション情報および広告効果測定情報</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">2. 利用目的</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed space-y-1 text-sp-txt">
          <li>サービスの提供・改善および新機能の検討</li>
          <li>不正アクセス・不正投稿の防止</li>
          <li>個人を識別できない形での統計データの作成</li>
          <li>アフィリエイト広告の効果測定（個別の購買行動と利用者を結び付ける形では使用しません）</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">3. Cookie の取り扱い</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-3">
          当サイトでは以下の 3 種類の Cookie を使用する場合があります。
        </p>
        <div className="space-y-3">
          {[
            {
              t: '必要 Cookie',
              d: 'サイト基本機能（初回訪問判定など）に使用します。同意は不要です。',
            },
            {
              t: '解析 Cookie',
              d: 'アクセス解析ツールが使用する場合があります。ブラウザ設定または各ツールのオプトアウト機構で拒否できます。',
            },
            {
              t: '広告 Cookie',
              d: 'アフィリエイト広告経由の購買・申込を計測するために、利用者がリンクをクリックした際に第三者から付与されます。',
            },
          ].map(c => (
            <div key={c.t} className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
              <div className="text-sm font-semibold text-sp-ink mb-1">{c.t}</div>
              <div className="text-sm text-sp-ink-soft leading-relaxed">{c.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">4. 第三者への提供・委託</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-3">
          以下のサービスを利用しており、サービス提供のため必要最小限の情報がそれぞれの事業者に送信されます。
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed space-y-1 text-sp-txt">
          <li>Supabase（米国 / Supabase Inc.）— 駅評価・通勤時間訂正データの保管</li>
          <li>Vercel（米国 / Vercel Inc.）— サイトホスティングおよびアクセスログ</li>
          <li>各アフィリエイトプロバイダ — 詳細は{' '}
            <Link href="/legal/ads" className="underline">広告表示について</Link>
            {' '}をご確認ください
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-sp-txt mt-3">
          上記以外、法令に基づく場合を除き、利用者本人の同意なく個人情報を第三者へ提供することはありません。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">5. 利用者の権利</h2>
        <p className="text-sm leading-relaxed text-sp-txt">
          利用者ご本人は、当サイトが保有する自身の情報について、開示・訂正・削除・利用停止の請求が可能です。
          ご希望の場合は{' '}
          <Link href="/legal/contact" className="underline">お問い合わせ</Link>
          {' '}よりご連絡ください。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">6. 改定について</h2>
        <p className="text-sm leading-relaxed text-sp-txt">
          本ポリシーは法令の変更またはサービスの改善に伴い、予告なく改定する場合があります。改定後は本ページ上にて公表します。
        </p>
      </section>

      <p className="text-xs text-sp-ink-soft/80 pt-6 border-t border-sp-ink-soft/15">
        最終更新日: {LAST_UPDATED}
      </p>
    </article>
  )
}
