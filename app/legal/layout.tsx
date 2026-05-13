import Link from 'next/link'
import { getSiteInfo, LAST_UPDATED } from '@/lib/site-info'

const NAV = [
  { href: '/legal/commerce', label: '特定商取引法に基づく表記' },
  { href: '/legal/privacy',  label: 'プライバシーポリシー' },
  { href: '/legal/ads',      label: '広告表示について' },
  { href: '/legal/contact',  label: 'お問い合わせ' },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteInfo()

  return (
    // root layout の <body> が overflow-hidden h-[100dvh] w-screen を保持しているため、
    // 法務ページでは fixed inset-0 + overflow-y-auto で独自のスクロール領域を作る。
    <div className="fixed inset-0 overflow-y-auto bg-sp-bg text-sp-txt">
      <header className="border-b border-sp-ink-soft/15 bg-sp-bg/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-sp-ink-soft hover:text-sp-ink transition-colors"
          >
            ← 地図へ戻る
          </Link>
          <span className="smallcaps text-sp-ink-soft">Legal / 法的情報</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        {children}
      </main>

      <footer className="border-t border-sp-ink-soft/15 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm text-sp-ink-soft hover:text-sp-ink transition-colors py-1"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-sp-ink-soft/80 leading-relaxed">
            © {new Date().getFullYear()} {site.siteName}. 最終更新: {LAST_UPDATED}
          </p>
          <p className="text-xs text-sp-ink-soft/80 mt-2 leading-relaxed">
            本サイトはアフィリエイト広告を利用しています。詳細は{' '}
            <Link href="/legal/ads" className="underline hover:text-sp-ink">
              広告表示について
            </Link>
            {' '}をご確認ください。
          </p>
        </div>
      </footer>
    </div>
  )
}
