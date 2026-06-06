'use client'
import { useEffect, useRef, useState } from 'react'
import { useSetAtom } from 'jotai'
import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { favoritesPanelOpenAtom } from '@/lib/atoms/favorites'

interface Props {
  onHelp: () => void
}

/**
 * 右上角ハンバーガーメニュー — Welcome 再表示・法的情報リンク・言語切替を集約。
 * 旧 HelpButton / LegalLink（左下フローティング 2 つ）を 1 つに統合し、
 * モバイル下半分の操作領域を解放する。
 *
 * safe-area-inset 対応：iPhone notch / Android status bar を回避。
 *
 * Link は next-intl 版を使用 — `/legal` 等のリンクが現在ロケールの prefix を
 * 自動継承し、`/zh/legal` 等に解決される (default ja は as-needed で素のまま)。
 */
export default function HeaderMenu({ onHelp }: Props) {
  const t = useTranslations('header')
  const tLang = useTranslations('language')
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const setFavoritesPanelOpen = useSetAtom(favoritesPanelOpenAtom)

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="absolute z-20"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open}
        className="w-10 h-10 rounded-full flex items-center justify-center
                   transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: open
            ? 'rgba(28,24,18,0.92)'
            : 'rgba(244,241,234,0.88)',
          color: open ? '#f5e7d2' : 'var(--ink)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '.5px solid rgba(28,24,18,.12)',
          boxShadow: '0 1px 2px rgba(0,0,0,.06), 0 6px 20px rgba(0,0,0,.12)',
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div
        className={`absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden
                    transition-all duration-200 origin-top-right
                    ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
        style={{
          background: 'rgba(244, 241, 234, 0.96)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '.5px solid rgba(28,24,18,.10)',
          boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.18)',
        }}
      >
        <div className="py-1.5">
          <MenuItem
            onClick={() => { setOpen(false); setFavoritesPanelOpen(true) }}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2l1.8 3.7 4.2.6-3 2.9.7 4.1L8 11.4l-3.7 1.9.7-4.1-3-2.9 4.2-.6L8 2z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
            }
            label={t('favorites')}
            sub={t('favoritesSub')}
          />

          <MenuItem
            onClick={() => { setOpen(false); onHelp() }}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            label={t('howToUse')}
            sub={t('howToUseSub')}
          />

          <div className="mx-3 h-px" style={{ background: 'rgba(28,24,18,.08)' }} />

          <MenuLink
            href="/legal"
            onNavigate={() => setOpen(false)}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            label={t('legal')}
            sub={t('legalSub')}
          />

          <MenuLink
            href="/legal/ads"
            onNavigate={() => setOpen(false)}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l2.5 2.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label={t('ads')}
            sub={t('adsSub')}
          />

          <div className="mx-3 h-px" style={{ background: 'rgba(28,24,18,.08)' }} />

          {/* 言語切替セクション — segmented control 風。Map 上でも切替できるよう
              HeaderMenu に常駐させる。Welcome 上の LocaleLink (sessionStorage flag) と
              違い、ここは Map context なので flag は立てず、reload 後も Map 表示が維持される。 */}
          <div className="px-3.5 py-2.5">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                  <ellipse cx="8" cy="8" rx="3" ry="6" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 8h12" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              <span
                className="text-sm leading-tight"
                style={{
                  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                  fontWeight: 600,
                  letterSpacing: '.02em',
                  color: 'var(--ink)',
                }}
              >
                {tLang('switcher')}
              </span>
            </div>
            <div className="flex gap-1.5" style={{ paddingLeft: 28 }}>
              <LocaleButton target="ja" active={locale === 'ja'} label="JA" pathname={pathname} onClose={() => setOpen(false)} />
              <LocaleButton target="zh" active={locale === 'zh'} label="ZH" pathname={pathname} onClose={() => setOpen(false)} />
              <LocaleButton target="en" active={locale === 'en'} label="EN" pathname={pathname} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LocaleButton({
  target, active, label, pathname, onClose,
}: {
  target: 'ja' | 'zh' | 'en'
  active: boolean
  label: string
  pathname: string
  onClose: () => void
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={pathname as any}
      locale={target}
      onClick={onClose}
      style={{
        padding: '4px 14px',
        fontFamily: 'var(--mono, ui-monospace, monospace)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '.18em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        color: active ? 'var(--ink)' : 'var(--ink-mute)',
        background: active ? 'rgba(28,24,18,.06)' : 'transparent',
        border: '.5px solid',
        borderColor: active ? 'rgba(28,24,18,.20)' : 'rgba(28,24,18,.08)',
        borderRadius: 6,
        transition: 'all .18s',
        cursor: 'pointer',
      }}
    >
      {label}
    </Link>
  )
}

function MenuItem({
  onClick, icon, label, sub,
}: { onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-black/[.04] transition-colors"
      style={{ color: 'var(--ink)' }}
    >
      <span className="flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-sm leading-tight"
          style={{
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            letterSpacing: '.02em',
          }}
        >
          {label}
        </span>
        <span
          className="block text-xs mt-0.5 leading-tight"
          style={{ color: 'var(--ink-mute)' }}
        >
          {sub}
        </span>
      </span>
    </button>
  )
}

function MenuLink({
  href, onNavigate, icon, label, sub,
}: { href: string; onNavigate: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-black/[.04] transition-colors"
      style={{ color: 'var(--ink)', textDecoration: 'none' }}
    >
      <span className="flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-sm leading-tight"
          style={{
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            letterSpacing: '.02em',
          }}
        >
          {label}
        </span>
        <span
          className="block text-xs mt-0.5 leading-tight"
          style={{ color: 'var(--ink-mute)' }}
        >
          {sub}
        </span>
      </span>
    </Link>
  )
}
