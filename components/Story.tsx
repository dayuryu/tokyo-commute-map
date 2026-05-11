'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

// 7 ページ構成（タイトル + 六章 + 終）。1 スクロール = 1 章。
// 各章ごとに固有の SVG モチーフを持つ：
//   0 タイトル        — calligraphic 圖
//   1 旅人           — city-light dots scatter
//   2 見知らぬ名のリスト — 斜めの定規が station name に変わる
//   3 老婆のことば    — concentric tea-steam ripples
//   4 もうひとつの地図 — isochrone rings emerge
//   5 駅は、暮らしである — minute clock + pull quote
//   6 終 + CTA      — final coda

const STORY_BG  = '#f3ecdd'
const STORY_INK = '#1c1812'
const STORY_RED = '#a8332b'
const STORY_DIM = '#7d7060'

const TOTAL = 7

interface StoryProps {
  onEnterMap: () => void
  onBack: () => void
}

export default function Story({ onEnterMap, onBack }: StoryProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [index, setIndex]   = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lockRef = useRef(false)
  const touchY  = useRef(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(TOTAL - 1, next))
    setIndex(clamped)
    const c = containerRef.current
    if (c) c.scrollTo({ top: clamped * c.clientHeight, behavior: 'smooth' })
  }, [])

  // closing fade out と同時に親へ即通知。親が次のレイヤーを先に mount し、
  // Story 自身は ~900ms 後に unmount される（page.tsx 側の setTimeout）。
  const enter = useCallback(() => {
    if (closing) return
    setClosing(true)
    onEnterMap()
  }, [closing, onEnterMap])

  const back = useCallback(() => {
    if (closing) return
    setClosing(true)
    onBack()
  }, [closing, onBack])

  // wheel / keyboard / touch — 1 ジェスチャ = 1 ページ
  useEffect(() => {
    const c = containerRef.current
    if (!c) return

    const lock = (ms = 900) => {
      lockRef.current = true
      setTimeout(() => { lockRef.current = false }, ms)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (lockRef.current) return
      if (Math.abs(e.deltaY) < 6) return
      lock()
      goTo(index + (e.deltaY > 0 ? 1 : -1))
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault(); if (lockRef.current) return; lock(700); goTo(index + 1)
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault(); if (lockRef.current) return; lock(700); goTo(index - 1)
      } else if (e.key === 'Home') {
        e.preventDefault(); goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault(); goTo(TOTAL - 1)
      } else if (e.key === 'Escape') {
        back()
      }
    }
    const onTouchStart = (e: TouchEvent) => { touchY.current = e.touches[0].clientY }
    const onTouchEnd   = (e: TouchEvent) => {
      const dy = touchY.current - e.changedTouches[0].clientY
      if (Math.abs(dy) < 40 || lockRef.current) return
      lock()
      goTo(index + (dy > 0 ? 1 : -1))
    }

    c.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    c.addEventListener('touchstart', onTouchStart, { passive: true })
    c.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      c.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      c.removeEventListener('touchstart', onTouchStart)
      c.removeEventListener('touchend',   onTouchEnd)
    }
  }, [index, goTo, back])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: STORY_BG, color: STORY_INK,
      fontFamily: 'var(--display-font, "Shippori Mincho","Hiragino Mincho ProN",serif)',
      opacity: closing ? 0 : (mounted ? 1 : 0),
      transition: 'opacity .9s cubic-bezier(.2,.8,.2,1)',
      WebkitFontSmoothing: 'antialiased',
      overflow: 'hidden',
    }}>
      {/* paper warmth — fixed, doesn't scroll */}
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

      {/* fixed chrome */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isMobile ? '14px 16px' : '22px 36px',
        pointerEvents: 'none',
      }}>
        <button onClick={back} style={{ ...chromeBtn, pointerEvents: 'auto', fontSize: isMobile ? 12 : 13 }}>
          <span style={{ fontSize: isMobile ? 13 : 14 }}>←</span>
          <span style={{ marginLeft: isMobile ? 6 : 10 }}>戻る</span>
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 11 : 13, fontWeight: 600,
          letterSpacing: isMobile ? '.2em' : '.32em', color: '#3a3328',
        }}>
          <span style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)', fontWeight: 400,
            fontSize: isMobile ? 9 : 10, letterSpacing: '.24em', color: STORY_DIM,
          }}>
            {String(index + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
          </span>
          {!isMobile && <span>物 語</span>}
        </div>
        <button onClick={enter} style={{ ...chromeBtn, color: STORY_RED, pointerEvents: 'auto', fontSize: isMobile ? 12 : 13 }}>
          <span>{isMobile ? 'マップ →' : '← マップへ'}</span>
        </button>
      </header>

      {/* page index — vertical dots（mobile 上隐藏，节约空间）*/}
      {!isMobile && <PageRail total={TOTAL} index={index} onJump={goTo} />}

      {/* the scroll container — locked to page steps */}
      <div ref={containerRef} style={{
        position: 'absolute', inset: 0, zIndex: 1,
        overflowY: 'hidden', overflowX: 'hidden',
        scrollSnapType: 'y mandatory',
      }}>
        <PageTitle    active={index === 0} isMobile={isMobile} />
        <PageArrival  active={index === 1} isMobile={isMobile} />
        <PageRuler    active={index === 2} isMobile={isMobile} />
        <PageOldWoman active={index === 3} isMobile={isMobile} />
        <PageRings    active={index === 4} isMobile={isMobile} />
        <PageMinutes  active={index === 5} isMobile={isMobile} />
        <PageCoda     active={index === 6} onEnter={enter} isMobile={isMobile} />
      </div>

      {/* hint */}
      <div style={{
        position: 'absolute', bottom: isMobile ? 16 : 26, left: 0, right: 0, zIndex: 20,
        textAlign: 'center', pointerEvents: 'none',
        fontFamily: 'var(--mono, "JetBrains Mono",monospace)', fontSize: isMobile ? 9 : 10,
        letterSpacing: '.4em', color: '#a89c82',
        opacity: index === TOTAL - 1 ? 0 : .9,
        transition: 'opacity .5s',
      }}>
        ↓ &nbsp; SCROLL
      </div>

      <style>{`
        @keyframes minTick { to { opacity: 1; } }
        @keyframes sweep   {
          from { transform: translate(-50%, 0) rotate(0deg); }
          to   { transform: translate(-50%, 0) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const chromeBtn: CSSProperties = {
  appearance: 'none', cursor: 'pointer',
  background: 'transparent', border: 'none', padding: '8px 4px',
  fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
  fontSize: 13, fontWeight: 500, letterSpacing: '.12em',
  color: STORY_INK,
  display: 'inline-flex', alignItems: 'center',
  transition: 'opacity .25s, color .25s',
}

// ─── Page shell ───────────────────────────────────────────────────────────
interface PageProps {
  children?: React.ReactNode
  active: boolean
  isMobile?: boolean
  n?: string
  en?: string
  jp?: string
  style?: CSSProperties
}

function Page({ children, active, isMobile, n, en, jp, style }: PageProps) {
  return (
    <section data-active={active} style={{
      position: 'relative',
      width: '100%', height: '100%',
      minHeight: '100vh', maxHeight: '100vh',
      scrollSnapAlign: 'start', scrollSnapStop: 'always',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      padding: isMobile ? '0 5vw' : '0 6vw', boxSizing: 'border-box',
      overflow: 'hidden',
      ...style,
    }}>
      {(n || en) && (
        <div style={{
          position: 'absolute',
          top: isMobile ? '8vh' : '13vh',
          left: isMobile ? '5vw' : '6vw',
          display: 'flex', alignItems: 'baseline',
          gap: isMobile ? 14 : 22,
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(-12px)',
          transition: 'opacity 1s .15s, transform 1s .15s',
        }}>
          <span style={{
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: isMobile ? 'clamp(34px, 11vw, 52px)' : 'clamp(46px, 5.5vw, 76px)',
            lineHeight: .9, fontWeight: 500,
            color: STORY_RED,
          }}>{n}</span>
          <span style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 11,
            letterSpacing: isMobile ? '.22em' : '.32em',
            textTransform: 'uppercase',
            color: STORY_DIM,
          }}>{en}</span>
        </div>
      )}
      {jp && (
        <div style={{
          position: 'absolute',
          // mobile: 移到左侧 n 标题下方，避免左右双栏挤
          top: isMobile ? 'calc(8vh + 60px)' : '14vh',
          left: isMobile ? '5vw' : 'auto',
          right: isMobile ? 'auto' : '6vw',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)', fontWeight: 600,
          fontSize: isMobile ? 'clamp(13px, 4.2vw, 17px)' : 'clamp(20px, 1.8vw, 24px)',
          letterSpacing: isMobile ? '.16em' : '.24em',
          color: STORY_INK,
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(-12px)',
          transition: 'opacity 1s .25s, transform 1s .25s',
        }}>
          {jp}
        </div>
      )}
      {children}
    </section>
  )
}

// ─── Vertical rail of dots ────────────────────────────────────────────────
function PageRail({ total, index, onJump }: { total: number; index: number; onJump: (i: number) => void }) {
  return (
    <div style={{
      position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
      zIndex: 25, display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onJump(i)} aria-label={`page ${i + 1}`}
          style={{
            appearance: 'none', border: 'none', background: 'transparent',
            padding: 4, cursor: 'pointer',
          }}>
          <span style={{
            display: 'block',
            width: i === index ? 22 : 6, height: i === index ? 1.5 : 1,
            background: i === index ? STORY_INK : '#a89c82',
            transition: 'all .35s cubic-bezier(.2,.8,.2,1)',
          }} />
        </button>
      ))}
    </div>
  )
}

// ─── 0 · Title ────────────────────────────────────────────────────────────
function PageTitle({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  return (
    <Page active={active} isMobile={isMobile}>
      <div style={{
        display: 'inline-flex', alignItems: 'center',
        gap: isMobile ? 14 : 22,
        color: STORY_RED,
        marginBottom: isMobile ? 22 : 32,
        opacity: active ? 1 : 0,
        transform: active ? 'translateX(0)' : 'translateX(-12px)',
        transition: 'opacity 1.2s .1s, transform 1.2s .1s',
      }}>
        <span style={{ width: isMobile ? 50 : 80, height: '.5px', background: 'currentColor' }} />
        <span style={{
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 26 : 34, fontWeight: 500,
        }}>圖</span>
        <span style={{ width: isMobile ? 50 : 80, height: '.5px', background: 'currentColor' }} />
      </div>
      <div style={{
        fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
        fontSize: isMobile ? 9 : 11,
        letterSpacing: isMobile ? '.24em' : '.32em',
        textTransform: 'uppercase', color: STORY_DIM,
        marginBottom: isMobile ? 22 : 30,
        opacity: active ? 1 : 0,
        transition: 'opacity 1.2s .25s',
      }}>
        A Fable in Six Chapters
      </div>
      <h1 style={{
        margin: 0, textAlign: 'center',
        fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
        fontStyle: 'italic', fontWeight: 400,
        fontSize: isMobile ? 'clamp(34px, 10vw, 52px)' : 'clamp(46px, 6.4vw, 96px)',
        lineHeight: 1.08, letterSpacing: '-.012em',
        color: STORY_INK, textWrap: 'balance' as CSSProperties['textWrap'],
        padding: isMobile ? '0 4px' : 0,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.4s .35s, transform 1.4s .35s',
      }}>
        A Thousand<br />Stations, A Thousand Lives
      </h1>
      <p style={{
        margin: isMobile ? '24px 0 0' : '34px 0 0',
        maxWidth: 520, textAlign: 'center',
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(12px, 3.5vw, 15px)' : 'clamp(14px, 1.3vw, 17px)',
        lineHeight: 2, letterSpacing: isMobile ? '.12em' : '.18em', color: '#5b574c',
        opacity: active ? 1 : 0,
        transition: 'opacity 1.4s .55s',
      }}>
        千の駅でできた、都のはなし。
      </p>
    </Page>
  )
}

// ─── 1 · Arrival — city light dots scatter in ────────────────────────────
function PageArrival({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  // deterministic pseudo-random dot field
  const dots = useMemo(() => {
    const arr: { x: number; y: number; r: number; d: number }[] = []
    let s = 9
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    for (let i = 0; i < 90; i++) {
      arr.push({ x: rnd() * 100, y: rnd() * 100, r: 0.6 + rnd() * 1.6, d: rnd() * 0.6 })
    }
    return arr
  }, [])
  return (
    <Page active={active} isMobile={isMobile} n="一" en="I · Arrival" jp="旅人">
      <div aria-hidden style={{
        position: 'absolute', inset: 0, opacity: active ? .9 : 0, transition: 'opacity 1.6s',
      }}>
        {dots.map((d, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
            width: d.r, height: d.r, borderRadius: 999,
            background: i % 11 === 0 ? STORY_RED : '#3a3328',
            opacity: active ? (i % 11 === 0 ? .9 : .45) : 0,
            transform: active ? 'scale(1)' : 'scale(.2)',
            transition: `opacity 1.4s ${.4 + d.d}s, transform 1.4s ${.4 + d.d}s`,
          }} />
        ))}
        {/* one falling traveler */}
        <span style={{
          position: 'absolute', left: '52%', top: active ? '52%' : '12%',
          width: 6, height: 6, borderRadius: 999, background: STORY_RED,
          boxShadow: '0 0 18px rgba(168,51,43,.55)',
          opacity: active ? 1 : 0,
          transition: 'top 2.4s cubic-bezier(.4,.0,.2,1) .3s, opacity 1s .3s',
        }} />
      </div>
      <div style={{
        position: 'relative',
        maxWidth: isMobile ? '100%' : 540,
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
        lineHeight: isMobile ? 2 : 2.25,
        letterSpacing: '.08em', color: STORY_INK,
        background: 'rgba(243,236,221,.78)',
        backdropFilter: 'blur(2px)',
        padding: isMobile ? '22px 22px' : '34px 40px',
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.2s .9s, transform 1.2s .9s',
      }}>
        <p style={{ margin: '0 0 .35em' }}>むかし、ある旅人が、</p>
        <p style={{ margin: '0 0 .35em' }}>東京という名の都に、降り立った。</p>
        <p style={{ margin: '.6em 0 .35em' }}>駅は千を数え、夜の灯は、</p>
        <p style={{ margin: '0 0 .35em' }}>名前の海のように、ひろがっていた。</p>
        <p style={{ margin: '.6em 0 0', color: STORY_RED }}>そのどれもが、彼の知らない、名前であった。</p>
      </div>
    </Page>
  )
}

// ─── 2 · A List of Strangers — diagonal ruler with station names ─────────
function PageRuler({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  // mobile: 11 ticks（少一些站名，避免重叠），desktop: 21
  const tickCount = isMobile ? 11 : 21
  const ticks = Array.from({ length: tickCount })
  const STATION_NAMES = [
    '北与野','志木','朝霞台','新小岩','綾瀬','北赤羽','南行徳',
    '本八幡','千歳烏山','西高島平','東中神','八広','梅島','五反野',
    '金町','西新井','竹ノ塚','馬込','大鳥居','京成立石','青砥',
  ]
  return (
    <Page active={active} isMobile={isMobile} n="二" en="II · A List of Strangers" jp="見知らぬ名のリスト">
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: isMobile ? '6%' : '8%',
          top: isMobile ? '82%' : '78%',
          width: isMobile ? '88%' : '84%',
          height: 56,
          transform: `rotate(${isMobile ? -5 : -7}deg) scaleX(${active ? 1 : 0})`,
          transformOrigin: 'left center',
          transition: 'transform 1.6s cubic-bezier(.2,.8,.2,1) .2s',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 28, height: 1, background: STORY_INK }} />
          {ticks.map((_, i) => {
            const major = i % 5 === 0
            const name = STATION_NAMES[i] || ''
            return (
              <div key={i} style={{
                position: 'absolute', left: `${(i / (ticks.length - 1)) * 100}%`,
                top: 28 - (major ? 18 : 10),
                width: 1, height: major ? 18 : 10,
                background: STORY_INK,
                opacity: active ? 1 : 0,
                transition: `opacity .5s ${0.4 + i * 0.04}s`,
              }}>
                <div style={{
                  position: 'absolute',
                  top: major ? -34 : -22,
                  left: isMobile ? -28 : -38,
                  width: isMobile ? 60 : 80,
                  textAlign: 'center',
                  fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                  fontSize: isMobile ? (major ? 10 : 9) : (major ? 12 : 10),
                  fontWeight: major ? 600 : 400,
                  letterSpacing: '.04em', color: major ? STORY_INK : STORY_DIM,
                  whiteSpace: 'nowrap',
                }}>{name}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{
        position: 'relative',
        maxWidth: isMobile ? '100%' : 620,
        marginTop: isMobile ? '6vh' : '4vh',
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
        lineHeight: isMobile ? 1.95 : 2.2,
        letterSpacing: '.08em', color: STORY_INK,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.1s .8s, transform 1.1s .8s',
      }}>
        <p style={{ margin: '0 0 .35em' }}>彼は、画面に問うた——</p>
        <p style={{ margin: '0 0 .35em' }}>「渋谷まで、三十分。家賃、七万。」</p>
        <p style={{ margin: '0 0 1em' }}>するとそこに、ずらりと、見知らぬ名前が、ならんだ。</p>
        <p style={{ margin: '0 0 .35em', color: STORY_DIM, fontStyle: 'italic' }}>
          名前を、ひとつひとつ、検索した。
        </p>
        <p style={{ margin: '0 0 .35em', color: STORY_DIM, fontStyle: 'italic' }}>
          地図を開き、口コミを読み、写真をめくった。
        </p>
        <p style={{ margin: '.5em 0 0', color: STORY_RED }}>けれど、駅は、ただの名前のままだった。</p>
      </div>
    </Page>
  )
}

// ─── 3 · The Old Woman — concentric tea-steam ripples ────────────────────
function PageOldWoman({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  return (
    <Page active={active} isMobile={isMobile} n="三" en="III · The Old Woman" jp="老婆のことば">
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: `${i * 14 + 12}vmin`, height: `${i * 14 + 12}vmin`,
            borderRadius: '50%',
            border: `.5px solid ${STORY_RED}`,
            opacity: active ? (0.42 - i * 0.06) : 0,
            transform: active ? 'scale(1)' : 'scale(.6)',
            transition: `opacity 1.4s ${0.2 + i * 0.12}s, transform 1.6s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.12}s`,
          }} />
        ))}
      </div>

      <p style={{
        position: 'relative',
        margin: isMobile ? '0 0 24px' : '0 0 36px',
        maxWidth: isMobile ? '100%' : 600,
        textAlign: 'center',
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(12px, 3.5vw, 15px)' : 'clamp(15px, 1.3vw, 18px)',
        lineHeight: isMobile ? 1.95 : 2.1,
        letterSpacing: '.1em', color: STORY_DIM,
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 1s .6s, transform 1s .6s',
      }}>
        ある雨の昼、軒先で、老婆に出会った。<br />
        湯気の立つ茶碗を、彼にすすめながら、<br />
        彼女は、しずかに、言った——
      </p>

      <blockquote style={{
        position: 'relative', margin: 0, padding: 0,
        maxWidth: isMobile ? '100%' : 900,
        textAlign: 'center',
        fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
        fontWeight: 500,
        fontSize: isMobile ? 'clamp(20px, 6.4vw, 32px)' : 'clamp(28px, 3.6vw, 50px)',
        lineHeight: isMobile ? 1.45 : 1.5,
        letterSpacing: '.04em', color: STORY_INK,
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 1.2s 1s, transform 1.2s 1s',
      }}>
        <span style={{ color: STORY_RED, fontSize: '1.4em', verticalAlign: '-.1em' }}>「</span>
        駅の名は、<br />
        まだ、なにも、語っていない
        <span style={{ color: STORY_RED, fontSize: '1.4em', verticalAlign: '-.1em' }}>」</span>
      </blockquote>
    </Page>
  )
}

// ─── 4 · The Other Map — isochrone rings emerge ──────────────────────────
function PageRings({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  const rings = [70, 130, 210, 300, 400, 510]
  // mobile: rings 中心を画面下部に移して文字と重ならないようにする
  const ringTransform = isMobile ? 'translate(500, 540)' : 'translate(680, 320)'
  return (
    <Page active={active} isMobile={isMobile} n="四" en="IV · The Other Map" jp="もうひとつの地図">
      <svg aria-hidden viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: active ? 1 : 0, transition: 'opacity 1s',
        }}>
        <g transform={ringTransform}>
          {rings.map((r, i) => (
            <circle key={i} cx="0" cy="0" r={r}
              fill="none" stroke={STORY_RED} strokeWidth=".6"
              strokeDasharray={2 * Math.PI * r}
              strokeDashoffset={active ? 0 : 2 * Math.PI * r}
              opacity={0.55 - i * 0.06}
              style={{ transition: `stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.18}s` }}
            />
          ))}
          <circle cx="0" cy="0" r="4" fill={STORY_RED}
            opacity={active ? 1 : 0}
            style={{ transition: 'opacity .6s .15s' }}
          />
        </g>
      </svg>

      <div style={{
        position: 'relative', alignSelf: 'flex-start',
        maxWidth: isMobile ? '100%' : 540,
        marginRight: 'auto', marginLeft: 0,
        marginTop: isMobile ? '6vh' : '4vh',
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
        lineHeight: isMobile ? 1.95 : 2.2,
        letterSpacing: '.08em', color: STORY_INK,
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.2s .8s, transform 1.2s .8s',
      }}>
        <p style={{ margin: '0 0 .8em' }}>老婆は、卓のうえに、しわくちゃの紙を広げた。</p>
        <p style={{ margin: '0 0 .35em' }}>ひとつひとつの駅に、</p>
        <p style={{ margin: '0 0 .35em' }}>家賃の輪、通勤の輪、</p>
        <p style={{ margin: '0 0 .35em' }}>市場の輪、人の声の輪が、</p>
        <p style={{ margin: '0', color: STORY_RED }}>暮らしのかたちで、ひろがっていた。</p>
      </div>
    </Page>
  )
}

// ─── 5 · A Station is a Life — minute clock + pull quote ─────────────────
function PageMinutes({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  const minutes = Array.from({ length: 60 })
  return (
    <Page active={active} isMobile={isMobile} n="五" en="V · A Station is a Life" jp="駅は、暮らしである">
      <div aria-hidden style={{
        position: 'absolute',
        // mobile: 钟表移到右下角小尺寸，避免遮文字
        left: isMobile ? 'auto' : '8%',
        right: isMobile ? '6%' : 'auto',
        top: isMobile ? 'auto' : '50%',
        bottom: isMobile ? '8vh' : 'auto',
        transform: isMobile ? 'none' : 'translateY(-50%)',
        width: isMobile ? 'min(35vw, 160px)' : 'min(40vh, 38vw)',
        aspectRatio: '1/1',
        opacity: active ? (isMobile ? 0.55 : 1) : 0,
        transition: 'opacity 1s .2s',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `.5px solid ${STORY_INK}`,
        }} />
        {minutes.map((_, i) => {
          const angle = (i / 60) * 360
          const major = i % 5 === 0
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 1, height: major ? 14 : 6,
              background: STORY_INK,
              transform: `translate(-50%, -100%) rotate(${angle}deg) translateY(calc(-50% + 1px))`,
              transformOrigin: 'bottom center',
              opacity: 0,
              animation: active ? `minTick .35s forwards ${0.3 + i * 0.012}s` : 'none',
            }} />
          )
        })}
        {/* sweeping hand */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 1.5, height: '46%', background: STORY_RED,
          transformOrigin: 'top center',
          transform: 'translate(-50%, 0)',
          animation: active ? 'sweep 6s linear .6s' : 'none',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 8, height: 8, borderRadius: '50%',
          background: STORY_RED, transform: 'translate(-50%, -50%)',
        }} />
      </div>

      <div style={{
        position: 'relative',
        marginLeft: isMobile ? 0 : 'auto',
        maxWidth: isMobile ? '100%' : 520,
        marginTop: isMobile ? '6vh' : '2vh',
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 1.2s .8s, transform 1.2s .8s',
      }}>
        <p style={{
          margin: isMobile ? '0 0 20px' : '0 0 28px',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(13px, 4vw, 16px)' : 'clamp(16px, 1.35vw, 19px)',
          lineHeight: isMobile ? 1.95 : 2.1,
          letterSpacing: '.08em', color: STORY_DIM,
        }}>
          老婆は、ゆびで、わを、なぞった——<br />
          「自由が丘の朝、荻窪の夕、三鷹の灯。<br />
          人は、区ではなく、駅で、自分を語る。<br />
          ひとつの駅は、ひとつの、暮らしのかたち。」
        </p>

        <div style={{
          height: 1, width: 60, background: STORY_RED,
          margin: isMobile ? '14px 0 18px' : '18px 0 22px',
        }} />

        <h3 style={{
          margin: 0,
          fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
          fontStyle: 'italic', fontWeight: 500,
          fontSize: isMobile ? 'clamp(24px, 7.4vw, 38px)' : 'clamp(34px, 4.2vw, 60px)',
          lineHeight: isMobile ? 1.2 : 1.25,
          letterSpacing: '.02em', color: STORY_INK,
        }}>
          東京は、千の<br />暮らしで、できている。
        </h3>
      </div>
    </Page>
  )
}

// ─── 6 · Coda + CTA ───────────────────────────────────────────────────────
function PageCoda({ active, onEnter, isMobile }: { active: boolean; onEnter: () => void; isMobile: boolean }) {
  return (
    <Page active={active} isMobile={isMobile} n="終" en="Coda · Your Station" jp="あなたの駅">
      <div style={{
        position: 'relative', textAlign: 'center',
        maxWidth: isMobile ? '100%' : 760,
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.2s .3s, transform 1.2s .3s',
      }}>
        <div style={{
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
          lineHeight: isMobile ? 2.1 : 2.4,
          letterSpacing: '.08em', color: STORY_INK,
          marginBottom: isMobile ? 32 : 56,
        }}>
          <p style={{ margin: '0 0 .35em' }}>あなたの住むべき駅は、</p>
          <p style={{ margin: '0 0 .35em' }}>知らない名前の、その先に、</p>
          <p style={{ margin: '0', color: STORY_RED }}>暮らしの輪として、ひろがっている。</p>
        </div>

        <h2 style={{
          margin: isMobile ? '0 0 18px' : '0 0 24px',
          fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
          fontStyle: 'italic', fontWeight: 400,
          fontSize: isMobile ? 'clamp(26px, 8vw, 42px)' : 'clamp(36px, 4.8vw, 64px)',
          lineHeight: isMobile ? 1.15 : 1.1,
          letterSpacing: '-.012em', color: STORY_INK,
          textWrap: 'balance' as CSSProperties['textWrap'],
          padding: isMobile ? '0 4px' : 0,
        }}>
          見知らぬ駅から、<br />暮らしを、読む。
        </h2>

        <p style={{
          margin: isMobile ? '0 auto 32px' : '0 auto 50px',
          maxWidth: isMobile ? '100%' : 560,
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(12px, 3.5vw, 14px)' : 'clamp(14px, 1.2vw, 16px)',
          lineHeight: isMobile ? 1.85 : 1.95,
          letterSpacing: '.06em', color: '#3a3328',
        }}>
          東京通勤<span style={{ color: STORY_RED }}>圖</span>は、
          千の駅を、家賃と通勤と暮らしの輪として、
          数秒で読みなおすための一冊です。
        </p>

        <button onClick={onEnter} style={{
          appearance: 'none', cursor: 'pointer',
          padding: isMobile ? '14px 28px' : '16px 40px',
          border: `.5px solid ${STORY_INK}`, background: STORY_INK, color: '#f5e7d2',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)', fontWeight: 600,
          fontSize: isMobile ? 13 : 14,
          letterSpacing: '.08em',
          borderRadius: 0,
          transition: 'all .25s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = STORY_RED; e.currentTarget.style.borderColor = STORY_RED }}
          onMouseLeave={e => { e.currentTarget.style.background = STORY_INK; e.currentTarget.style.borderColor = STORY_INK }}
        >
          ← マップへ
        </button>

        <div style={{
          marginTop: isMobile ? 20 : 30,
          fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
          fontSize: isMobile ? 9 : 10,
          letterSpacing: '.32em', color: '#a89c82',
        }}>
          Tokyo Commute Atlas · MMXXVI
        </div>
      </div>
    </Page>
  )
}
