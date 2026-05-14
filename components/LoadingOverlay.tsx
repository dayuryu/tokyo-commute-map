'use client'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

// editorial palette — DestinationAsk と統一（cream paper + ink + red accent）
const LOAD_BG  = '#f3ecdd'
const LOAD_INK = '#1c1812'
const LOAD_RED = '#a8332b'
const LOAD_DIM = '#7d7060'
const LOAD_MUT = '#a89c82'

interface Props {
  /** true: 加载画面显示。false: 渐隐后由父组件 unmount。 */
  visible: boolean
}

/**
 * Welcome / DestinationAsk → Map の間に挟まる「まちを呼び出しています」
 * 加载画面。MapView が `onReady` を発火するまで前景に表示し、
 * 内側 mincho hint を 1.8s ごとにフェードでループさせる。
 *
 * 自身は z=88（DestinationAsk=85 の上、WelcomeOverlay=100 の下）。
 * 親側で `visible=false` にすると ~1.1s かけて opacity 0 へ。
 */
export default function LoadingOverlay({ visible }: Props) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)

  const HINTS = [
    '路線をひいています',
    '駅をならべています',
    '通勤の地図を描いています',
  ]

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(
      () => setHintIdx(i => (i + 1) % HINTS.length),
      1800,
    )
    return () => window.clearInterval(id)
  }, [HINTS.length])

  const ringSize = isMobile ? 116 : 148

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, zIndex: 88,
        background: LOAD_BG, color: LOAD_INK,
        fontFamily: 'var(--display-font, "Shippori Mincho","Hiragino Mincho ProN",serif)',
        // backdrop は visible=true なら即座に opacity=1（地図の闪现防止）。
        // 内側の compass / title / hint 子要素は mounted フラグで polish フェードする。
        // 消える時のみ 1.1s でゆっくり fade out（visible=false）。
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 0s'
          : 'opacity 1.1s cubic-bezier(.2,.8,.2,1)',
        pointerEvents: visible ? 'auto' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* paper warmth — DestinationAsk と完全に同じ */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background:
          'radial-gradient(ellipse at 50% 38%, rgba(255,246,228,.55), transparent 55%),'
          + ' radial-gradient(ellipse at 80% 90%, rgba(168,51,43,.06), transparent 50%)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: .06, mixBlendMode: 'multiply',
        backgroundImage: 'radial-gradient(rgba(28,24,18,.6) .5px, transparent .6px)',
        backgroundSize: '3px 3px',
      }} />

      {/* brand mark (top-center): Kayoha + 通葉 */}
      <div style={{
        position: 'absolute', top: isMobile ? 22 : 32,
        left: 0, right: 0,
        textAlign: 'center', zIndex: 1,
        color: LOAD_DIM,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 1s .15s',
        lineHeight: 1.1,
      }}>
        <div style={{
          fontFamily: 'var(--font-cormorant), "Cormorant Garamond", serif',
          fontSize: isMobile ? 20 : 24,
          fontWeight: 400,
          letterSpacing: '.06em',
        }}>Kayoha</div>
        <div style={{
          fontFamily: 'var(--font-shippori), "Shippori Mincho", serif',
          fontSize: isMobile ? 9 : 11,
          fontWeight: 600,
          color: LOAD_RED,
          letterSpacing: '.3em',
          marginTop: 3,
        }}>通葉</div>
      </div>

      {/* ── 中央の compass loader ────────────────────── */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: ringSize, height: ringSize,
          marginBottom: isMobile ? 30 : 40,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1)' : 'scale(.92)',
          transition: 'opacity .9s cubic-bezier(.2,.8,.2,1) .1s, transform .9s cubic-bezier(.2,.8,.2,1) .1s',
        }}
      >
        {/* 三つの呼吸する pulse ring */}
        {[0, 1, 2].map(i => (
          <span
            key={i}
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              border: `.5px solid ${LOAD_INK}`,
              borderRadius: '50%',
              opacity: 0,
              animation: `tcmLoaderPulse 3s cubic-bezier(.4,0,.2,1) ${i * 1}s infinite`,
            }}
          />
        ))}

        {/* ゆっくり回る compass（floral mark を継承） */}
        <svg
          viewBox="0 0 100 100"
          width="100%" height="100%"
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            animation: 'tcmLoaderCompass 16s linear infinite',
          }}
        >
          <circle cx="50" cy="50" r="34" fill="none" stroke={LOAD_INK} strokeWidth=".5" opacity=".35" />
          <circle cx="50" cy="50" r="22" fill="none" stroke={LOAD_INK} strokeWidth=".4" opacity=".25" />
          <circle cx="50" cy="50" r="3.4" fill={LOAD_RED} />
          {/* 4 方位の点（Welcome の floral mark と同型） */}
          <circle cx="50" cy="14" r="2" fill={LOAD_INK} />
          <circle cx="50" cy="86" r="2" fill="none" stroke={LOAD_INK} strokeWidth=".7" />
          <circle cx="14" cy="50" r="2" fill="none" stroke={LOAD_INK} strokeWidth=".7" />
          <circle cx="86" cy="50" r="2" fill="none" stroke={LOAD_INK} strokeWidth=".7" />
          {/* 細い hairline 十字 */}
          <line x1="50" y1="6"  x2="50" y2="20" stroke={LOAD_INK} strokeWidth=".4" opacity=".5" />
          <line x1="50" y1="80" x2="50" y2="94" stroke={LOAD_INK} strokeWidth=".4" opacity=".5" />
          <line x1="6"  y1="50" x2="20" y2="50" stroke={LOAD_INK} strokeWidth=".4" opacity=".5" />
          <line x1="80" y1="50" x2="94" y2="50" stroke={LOAD_INK} strokeWidth=".4" opacity=".5" />
        </svg>

        {/* 逆回転する arc — 速め */}
        <svg
          viewBox="0 0 100 100"
          width="100%" height="100%"
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            animation: 'tcmLoaderArc 3.4s linear infinite',
          }}
        >
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke={LOAD_INK}
            strokeWidth=".5"
            strokeDasharray="22 254"
            strokeLinecap="round"
            opacity=".75"
          />
        </svg>
      </div>

      {/* ── 主タイトル（italic） ─────────────────────── */}
      <p style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
        fontStyle: 'italic', fontWeight: 400,
        fontSize: isMobile ? 'clamp(20px, 5.8vw, 26px)' : 'clamp(26px, 2.2vw, 34px)',
        color: LOAD_RED,
        margin: 0,
        letterSpacing: '-.01em',
        lineHeight: 1.15,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 1s .25s, transform 1s .25s',
      }}>
        Drawing the city…
      </p>

      {/* ── 切替わる mincho hint ─────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        height: isMobile ? 24 : 28,
        marginTop: isMobile ? 14 : 18,
        width: '100%',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 1s .35s',
      }}>
        {HINTS.map((h, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0, right: 0,
              top: 0,
              textAlign: 'center',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 13 : 14.5,
              letterSpacing: '.18em',
              color: LOAD_DIM,
              opacity: i === hintIdx ? 1 : 0,
              transform: `translateY(${i === hintIdx ? 0 : 6}px)`,
              transition: 'opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.4,0,.2,1)',
              pointerEvents: 'none',
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* ── 下部 mono タグ ──────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? 28 : 44,
        left: 0, right: 0,
        textAlign: 'center', zIndex: 1,
        fontFamily: 'var(--mono, "JetBrains Mono",ui-monospace,monospace)',
        fontSize: isMobile ? 9 : 10,
        letterSpacing: '.32em',
        color: LOAD_MUT,
        textTransform: 'uppercase',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 1s .5s',
      }}>
        1,843 stations · drawing
      </div>
    </div>
  )
}
