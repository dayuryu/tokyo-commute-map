'use client'
import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Destination, CustomStation } from '@/app/page'
import { QUICK_DESTINATIONS, POPULAR_DESTINATIONS } from '@/lib/destinations'

// editorial palette は Story と統一
const ASK_BG  = '#f3ecdd'
const ASK_INK = '#1c1812'
const ASK_RED = '#a8332b'
const ASK_DIM = '#7d7060'

interface Props {
  stationList: CustomStation[]
  onConfirm: (destination: Destination, customStation: CustomStation | null) => void
  /** AI 推薦パスを起動 — Wizard を開く（destination は Wizard 内 Q1 で選択） */
  onStartWizard: () => void
  /** AI 推薦リコール — 24h 以内に既に推薦を行っていれば、Wizard を result phase で再起動 */
  onRecallWizard: () => void
  /** 24h 以内に AI 推薦キャッシュが存在するか。true なら hero CTA は「再表示」モードへ変身 */
  aiCacheFresh: boolean
}

/**
 * 「通勤先を教えてください」全画面オーバーレイ。
 * Welcome / Story → Map の間に挟まり、ユーザに目的駅を任意で指定させる。
 * skip 選択時は default 'shinjuku' で進む。
 *
 * 親 (page.tsx) は onConfirm を受けて setMapMounted(true) し、
 * フェード完了後にこのコンポーネント自体を unmount する。
 */
export default function DestinationAsk({
  stationList,
  onConfirm,
  onStartWizard,
  onRecallWizard,
  aiCacheFresh,
}: Props) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMorePopular, setShowMorePopular] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // デスクトップは fade in 完了後にフォーカス（モバイルはキーボード暴発を避けて非自動）
  useEffect(() => {
    if (!isMobile && mounted) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 700)
      return () => window.clearTimeout(id)
    }
  }, [isMobile, mounted])

  const filtered = query.length >= 1
    ? stationList.filter(s => s.name.includes(query)).slice(0, 6)
    : []

  function close(dest: Destination, custom: CustomStation | null) {
    if (closing) return
    setClosing(true)
    onConfirm(dest, custom)
  }

  function startWizard() {
    if (closing) return
    setClosing(true)
    onStartWizard()
  }

  function recallWizard() {
    if (closing) return
    setClosing(true)
    onRecallWizard()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 85,
      background: ASK_BG, color: ASK_INK,
      fontFamily: 'var(--display-font, "Shippori Mincho","Hiragino Mincho ProN",serif)',
      opacity: closing ? 0 : (mounted ? 1 : 0),
      transition: 'opacity .9s cubic-bezier(.2,.8,.2,1)',
      WebkitFontSmoothing: 'antialiased',
      overflow: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '60px 5vw' : '8vh 6vw',
      boxSizing: 'border-box',
    }}>
      {/* paper warmth — Story と同じパターン */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 18%, rgba(255,246,228,.55), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(168,51,43,.06), transparent 50%)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: .06, mixBlendMode: 'multiply',
        backgroundImage: 'radial-gradient(rgba(28,24,18,.6) .5px, transparent .6px)',
        backgroundSize: '3px 3px',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: isMobile ? '100%' : 560,
        width: '100%',
        textAlign: 'center',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1s .2s, transform 1s .2s',
      }}>
        {/* smallcaps marker */}
        <div style={{
          fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
          fontSize: isMobile ? 9 : 10,
          letterSpacing: '.4em', textTransform: 'uppercase',
          color: ASK_DIM,
          marginBottom: isMobile ? 18 : 22,
        }}>
          Where · 通勤先
        </div>

        {/* italic prelude */}
        <p style={{
          fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
          fontStyle: 'italic',
          fontSize: isMobile ? 'clamp(18px, 5.6vw, 26px)' : 'clamp(26px, 2.8vw, 38px)',
          fontWeight: 400,
          color: ASK_RED,
          margin: 0,
          letterSpacing: '-.01em',
          lineHeight: 1.15,
        }}>
          Where do you commute?
        </p>

        {/* 主標題（明朝大字） */}
        <h1 style={{
          margin: isMobile ? '18px 0 14px' : '24px 0 18px',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontWeight: 600,
          fontSize: isMobile ? 'clamp(22px, 6.4vw, 30px)' : 'clamp(28px, 3.2vw, 42px)',
          lineHeight: isMobile ? 1.35 : 1.25,
          letterSpacing: '.06em',
          color: ASK_INK,
        }}>
          あなたの通勤先を、<br />教えてください。
        </h1>

        {/* 副標題 */}
        <p style={{
          margin: isMobile ? '0 0 24px' : '0 0 28px',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(12px, 3.5vw, 14px)' : 'clamp(13px, 1.15vw, 16px)',
          lineHeight: 1.85,
          letterSpacing: '.08em',
          color: ASK_DIM,
        }}>
          ここから、1,793 駅が、<br />あなたの中心を語りはじめる。
        </p>

        {/* ── AI 推薦 hero card ────────────────────────────────────
            DestinationAsk のもう一つの分岐入口。
            - 新規（aiCacheFresh=false）: 「6 つの質問に答えて、AI に提案してもらう」
            - 利用済み（aiCacheFresh=true）: 「過去の推薦を再表示する」+ 24h ルール注記
            「AI は探索の補助、1 日 1 回まで」が主人のポリシー。 */}
        <button
          onClick={aiCacheFresh ? recallWizard : startWizard}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: isMobile ? '100%' : 420,
            margin: isMobile ? '0 auto 14px' : '0 auto 16px',
            padding: isMobile ? '14px 16px' : '16px 22px',
            background: 'rgba(168,51,43,.06)',
            border: `.5px solid ${ASK_RED}`,
            color: ASK_INK,
            cursor: 'pointer',
            transition: 'all .25s',
            textAlign: 'center',
            borderRadius: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = ASK_RED
            e.currentTarget.style.color = '#f5e7d2'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(168,51,43,.06)'
            e.currentTarget.style.color = ASK_INK
          }}
        >
          <div style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '.32em',
            textTransform: 'uppercase',
            opacity: .8,
          }}>
            {aiCacheFresh ? '✦ AI Advisor · 利用済み' : '✦ AI Advisor · 新機能'}
          </div>
          <div style={{
            marginTop: 6,
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 16 : 18,
            letterSpacing: '-.01em',
          }}>
            {aiCacheFresh
              ? 'your twenty places, ready to revisit'
              : 'let AI choose twenty places for you'}
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 13 : 14,
            letterSpacing: '.06em',
          }}>
            {aiCacheFresh
              ? '過去の推薦 20 駅を再表示する →'
              : '6 つの質問に答えて、AI に提案してもらう →'}
          </div>
        </button>

        {/* 24h ルール注記 — 利用済み時のみ、押せない理由を明示する */}
        {aiCacheFresh && (
          <p
            style={{
              margin: isMobile ? '0 0 30px' : '0 0 36px',
              fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
              fontStyle: 'italic',
              fontSize: isMobile ? 11 : 12,
              color: ASK_DIM,
              letterSpacing: '.02em',
              lineHeight: 1.6,
            }}
          >
            新しい推薦の作成は 24 時間に 1 回までです。
          </p>
        )}
        {!aiCacheFresh && (
          <div style={{ marginBottom: isMobile ? 30 : 36 }} />
        )}

        {/* hairline divider — AI パスと手動パスを軽く区切る */}
        <div
          aria-hidden
          style={{
            height: 1,
            background: 'rgba(28,24,18,.10)',
            margin: isMobile ? '0 0 22px' : '0 0 26px',
            maxWidth: 280,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />

        {/* search input */}
        <div style={{
          position: 'relative',
          maxWidth: isMobile ? '100%' : 360,
          margin: '0 auto',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => window.setTimeout(() => setShowDropdown(false), 180)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filtered.length > 0) close('custom', filtered[0])
            }}
            placeholder="駅名を入力（例：吉祥寺）"
            style={{
              width: '100%',
              padding: isMobile ? '12px 16px' : '14px 18px',
              background: 'rgba(255,255,255,.6)',
              border: `.5px solid ${ASK_INK}`,
              borderRadius: 0,
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 14 : 15,
              color: ASK_INK,
              letterSpacing: '.04em',
              textAlign: 'center',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {showDropdown && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: 2,
              background: 'rgba(243,236,221,.96)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              border: `.5px solid ${ASK_INK}`,
              maxHeight: 240, overflowY: 'auto',
              zIndex: 10,
              textAlign: 'left',
            }}>
              {filtered.map(s => (
                <button
                  key={s.code}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => close('custom', s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: isMobile ? '10px 16px' : '12px 18px',
                    background: 'transparent', border: 'none',
                    fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                    fontSize: isMobile ? 14 : 15,
                    color: ASK_INK,
                    letterSpacing: '.04em',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background .2s',
                  } as CSSProperties}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,51,43,.10)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* または */}
        <div style={{
          margin: isMobile ? '24px 0 14px' : '32px 0 18px',
          fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
          fontSize: isMobile ? 9 : 10,
          letterSpacing: '.32em', textTransform: 'uppercase',
          color: '#a89c82',
        }}>
          — or 定番の駅から —
        </div>

        {/* Quick CTAs (3 駅) */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 8 : 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          margin: isMobile ? '0 0 14px' : '0 0 18px',
        }}>
          {QUICK_DESTINATIONS.map(opt => (
            <button
              key={opt.slug}
              onClick={() => close(opt.slug as Destination, null)}
              style={{
                padding: isMobile ? '10px 18px' : '12px 26px',
                background: 'transparent',
                border: `.5px solid ${ASK_INK}`,
                color: ASK_INK,
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: isMobile ? 13 : 14,
                letterSpacing: '.06em',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all .25s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = ASK_INK
                e.currentTarget.style.color = '#f5e7d2'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = ASK_INK
              }}
            >
              {opt.displayName}
            </button>
          ))}
        </div>

        {/* Popular 27 駅 — 展開可能 */}
        {!showMorePopular ? (
          <button
            onClick={() => setShowMorePopular(true)}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.06em',
              color: ASK_DIM,
              cursor: 'pointer',
              padding: 4,
              margin: isMobile ? '0 0 28px' : '0 0 36px',
              transition: 'color .25s',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = ASK_INK }}
            onMouseLeave={e => { e.currentTarget.style.color = ASK_DIM }}
          >
            他の人気通勤先 27 駅 ▼
          </button>
        ) : (
          <div style={{
            margin: isMobile ? '0 0 28px' : '0 0 36px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: isMobile ? 6 : 8,
            justifyContent: 'center',
            maxWidth: '100%',
          }}>
            {POPULAR_DESTINATIONS.map(opt => (
              <button
                key={opt.slug}
                onClick={() => close(opt.slug as Destination, null)}
                style={{
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  background: 'rgba(255,255,255,.4)',
                  border: '.5px solid rgba(28,24,18,.25)',
                  color: ASK_INK,
                  fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                  fontWeight: 500,
                  fontSize: isMobile ? 12 : 12.5,
                  letterSpacing: '.04em',
                  borderRadius: 0,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = ASK_INK
                  e.currentTarget.style.color = '#f5e7d2'
                  e.currentTarget.style.borderColor = ASK_INK
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.4)'
                  e.currentTarget.style.color = ASK_INK
                  e.currentTarget.style.borderColor = 'rgba(28,24,18,.25)'
                }}
              >
                {opt.displayName}
              </button>
            ))}
          </div>
        )}

        {/* Skip CTA */}
        <button
          onClick={() => close('shinjuku', null)}
          style={{
            background: 'transparent', border: 'none',
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: isMobile ? 12 : 13,
            letterSpacing: '.08em',
            color: ASK_DIM,
            cursor: 'pointer',
            padding: 4,
            transition: 'color .25s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = ASK_INK }}
          onMouseLeave={e => { e.currentTarget.style.color = ASK_DIM }}
        >
          とりあえず眺める →
        </button>

        {/* bottom mark — Story の Coda と統一 */}
        <div style={{
          marginTop: isMobile ? 24 : 32,
          fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
          fontSize: isMobile ? 9 : 10,
          letterSpacing: '.32em', color: '#a89c82',
        }}>
          1,793 stations · waiting
        </div>
      </div>
    </div>
  )
}
