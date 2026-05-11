import type { Metadata } from 'next'
import Link from 'next/link'
import { getSiteInfo } from '@/lib/site-info'

export const metadata: Metadata = {
  title: '法的情報 | 東京圏通勤マップ',
  description: '東京圏通勤マップの特定商取引法表記・プライバシーポリシー・広告表示ポリシー・お問い合わせ情報。',
}

const ENTRIES = [
  {
    href: '/legal/commerce',
    title: '特定商取引法に基づく表記',
    summary: '運営者情報・連絡先・提供役務の表示',
  },
  {
    href: '/legal/privacy',
    title: 'プライバシーポリシー',
    summary: '取得する情報・利用目的・Cookie の取り扱い',
  },
  {
    href: '/legal/ads',
    title: '広告表示について',
    summary: '利用しているアフィリエイトプログラム・PR 表示の方針',
  },
  {
    href: '/legal/contact',
    title: 'お問い合わせ',
    summary: 'ご連絡先メールアドレス',
  },
]

export default function LegalIndexPage() {
  const site = getSiteInfo()

  return (
    <article className="fade-up">
      <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
        法的情報
      </h1>
      <p className="text-sp-ink-soft leading-relaxed mb-10">
        {site.siteNameJa}（{site.siteName}）の運営に関する各種ポリシーをご案内します。
      </p>

      <ul className="space-y-3">
        {ENTRIES.map(entry => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className="block border border-sp-ink-soft/20 rounded-xl px-5 py-4
                         hover:border-sp-ink/40 hover:bg-white/30 transition-colors"
            >
              <div className="font-display text-lg text-sp-ink mb-1">
                {entry.title}
              </div>
              <div className="text-sm text-sp-ink-soft">{entry.summary}</div>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}
