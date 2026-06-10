'use client'

/**
 * /ryugaku 測試から `?rstations=` で流入した時に地図下部中央に出す説明 chip。
 * 「この色環は何？」の答えを与えつつ、✕ で highlight を消せる。
 * 文言は内蔵 3 locale（メッセージファイル追加を避ける軽量実装 — 表示は一過性）。
 */
import { useAtom } from 'jotai'
import { useLocale } from 'next-intl'
import { ryugakuHighlightAtom } from '@/lib/atoms/ryugaku'
import { useIsMobile } from '@/lib/useIsMobile'

const LABELS: Record<string, string> = {
  zh: '你的本命车站',
  ja: 'あなたの本命駅',
  en: 'Your destined stations',
}

export default function RyugakuStationsChip() {
  const [hl, setHl] = useAtom(ryugakuHighlightAtom)
  const locale = useLocale()
  const isMobile = useIsMobile()
  if (!hl) return null

  function dismiss() {
    setHl(null)
    // query を剥がして reload 時の再点灯を防ぐ（履歴は汚さない）
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('rstations')
      url.searchParams.delete('rc')
      window.history.replaceState(null, '', url.pathname + url.search)
    } catch {}
  }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 11,
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: isMobile
          ? 'calc(max(12px, env(safe-area-inset-bottom)) + 32px)'
          : 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 8px 8px 14px',
        borderRadius: 999,
        background: 'rgba(244, 241, 234, 0.86)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: '1px solid rgba(0,0,0,.07)',
        boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.12)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* 型色の環（地図上の ring と同じ見た目） */}
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: `2.5px solid ${hl.color}`,
          background: `${hl.color}1f`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1f1d18' }}>
        {LABELS[locale] ?? LABELS.zh}
      </span>
      <button
        onClick={dismiss}
        aria-label="dismiss"
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          border: 'none',
          background: 'rgba(31,29,24,0.08)',
          color: '#5b574c',
          fontSize: 14,
          lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
