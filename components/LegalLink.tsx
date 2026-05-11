'use client'
import Link from 'next/link'

/**
 * 法的情報ページ（/legal）へのコーナーリンク。
 * 地図は全画面構成で footer が無いため、HelpButton の隣に i ボタンとして配置。
 * HelpButton より一回り小さく半透明にして視覚的に控えめにする。
 */
export default function LegalLink() {
  return (
    <Link
      href="/legal"
      title="法的情報"
      aria-label="法的情報"
      className="absolute bottom-4 left-[68px] z-10
                 w-9 h-9 rounded-full
                 flex items-center justify-center
                 transition-all duration-200
                 hover:scale-110 active:scale-95"
      style={{
        background: 'rgba(28,24,18,0.55)',
        backdropFilter: 'blur(10px) saturate(140%)',
        WebkitBackdropFilter: 'blur(10px) saturate(140%)',
        color: '#f5e7d2',
        border: '.5px solid rgba(245,231,210,.20)',
        boxShadow: '0 1px 2px rgba(0,0,0,.10), 0 4px 14px rgba(0,0,0,.14)',
        fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: 17,
        letterSpacing: '.02em',
        lineHeight: 1,
        textDecoration: 'none',
      }}
    >
      i
    </Link>
  )
}
