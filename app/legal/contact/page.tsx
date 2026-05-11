import type { Metadata } from 'next'
import { getSiteInfo } from '@/lib/site-info'

export const metadata: Metadata = {
  title: 'お問い合わせ | 東京圏通勤マップ',
  description: '東京圏通勤マップへのご連絡先。',
}

export default function ContactPage() {
  const site = getSiteInfo()

  return (
    <article className="fade-up">
      <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
        お問い合わせ
      </h1>
      <p className="text-sm leading-relaxed text-sp-ink-soft mb-10">
        {site.siteNameJa}に関するご意見・ご質問・不具合のご報告は、以下のメールアドレスまでお願いいたします。
      </p>

      <div className="border border-sp-ink-soft/20 rounded-xl px-6 py-8 bg-white/30 mb-8">
        <div className="smallcaps text-sp-ink-soft mb-2">Email</div>
        <a
          href={`mailto:${site.contactEmail}`}
          className="font-mono-num text-lg md:text-xl text-sp-ink hover:underline break-all"
        >
          {site.contactEmail}
        </a>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-sp-txt">
        <p>
          返信には <span className="font-mono-num">3〜7</span> 営業日いただく場合があります。お急ぎの場合や個別の事情がある場合は、件名にその旨を明記いただけますと幸いです。
        </p>
        <p>
          駅情報の通勤時間に誤りがある場合は、各駅詳細ドロワー内の「訂正を報告」機能からもご報告いただけます（こちらのほうが反映が早い場合があります）。
        </p>
        <p>
          いただいたメールに記載の個人情報は、本件のご返信およびサービス改善以外の目的では使用いたしません。
        </p>
      </section>
    </article>
  )
}
