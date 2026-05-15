'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

// 3 ページ構成（旧 7 章から精選）。
// 各章は「テーマ → 産品価値 → CTA」の流れで、文学密度を抑え行動への導線を最短化する。
//   1 知らない名前       — city-light scatter + AI との対比
//   2 もうひとつの地図   — isochrone rings + 駅の色点で価値を視覚化
//   終 あなたの番        — 探索のための CTA

const STORY_BG  = '#f3ecdd'
const STORY_INK = '#1c1812'
const STORY_RED = '#a8332b'
const STORY_DIM = '#7d7060'

const TOTAL = 3

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

  // 翻頁状態の ref ──全部 component-level に置き、event listener effect の再 mount を防ぐ。
  // 旧設計は useEffect deps [index, goTo, back] により翻頁毎に cleanup → re-run していたため、
  // cleanup 時に unlock の setTimeout が clear され、scrollend 非対応 browser
  // (iOS Safari ≤17 / 旧 Android Chrome 等) では 1 度翻頁すると永久ロック →
  // 第3頁から戻ろうとすると卡死する deadlock があった。
  const unlockTimerRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const onBackRef = useRef(onBack)
  const onEnterMapRef = useRef(onEnterMap)

  // ref を最新 prop / state に同期 (handler closure stale 防止)
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { onBackRef.current = onBack }, [onBack])
  useEffect(() => { onEnterMapRef.current = onEnterMap }, [onEnterMap])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const lock = useCallback((fallbackMs = 1100) => {
    lockRef.current = true
    if (unlockTimerRef.current != null) window.clearTimeout(unlockTimerRef.current)
    unlockTimerRef.current = window.setTimeout(() => {
      lockRef.current = false
      unlockTimerRef.current = null
    }, fallbackMs)
  }, [])

  const goTo = useCallback((next: number) => {
    const c = containerRef.current
    if (!c) return
    const clamped = Math.max(0, Math.min(TOTAL - 1, next))
    // 既に目的の位置にいる場合は何もしない（連続イベントで lock がかかるのを防ぐ）
    if (clamped === indexRef.current) return
    indexRef.current = clamped
    setIndex(clamped)
    c.scrollTo({ top: clamped * c.clientHeight, behavior: 'smooth' })
  }, [])

  const enter = useCallback(() => {
    if (closing) return
    setClosing(true)
    onEnterMapRef.current()
  }, [closing])

  const back = useCallback(() => {
    if (closing) return
    setClosing(true)
    onBackRef.current()
  }, [closing])

  // wheel / keyboard / touch — 1 ジェスチャ = 1 ページ
  //
  // 設計メモ:
  //  - lock / goTo は useCallback([]) で stable、indexRef 経由で最新 index を読む
  //  - この effect は mount-only (deps [lock, goTo] = stable refs)、翻頁毎に
  //    cleanup → re-run しない → unlockTimer が予定通り fire できる
  //  - lock 解錠経路は 2 つ:
  //    (a) scrollend 即時解錠 (Chrome 114+ / Firefox 109+ / Safari 18+)
  //    (b) 1100ms fallback setTimeout (全 browser、scrollend 非対応時の保険)
  //  - 速い連続スワイプ対策: lock 中の event は全部捨てる (1 ジェスチャ = 1 頁)
  useEffect(() => {
    const c = containerRef.current
    if (!c) return

    // smooth scroll 完了で即解錠（対応ブラウザでは fallback より早く発火）
    const onScrollEnd = () => {
      if (unlockTimerRef.current != null) {
        window.clearTimeout(unlockTimerRef.current)
        unlockTimerRef.current = null
      }
      lockRef.current = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (lockRef.current) return
      if (Math.abs(e.deltaY) < 6) return
      lock()
      goTo(indexRef.current + (e.deltaY > 0 ? 1 : -1))
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault(); if (lockRef.current) return; lock(900); goTo(indexRef.current + 1)
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault(); if (lockRef.current) return; lock(900); goTo(indexRef.current - 1)
      } else if (e.key === 'Home') {
        e.preventDefault(); if (lockRef.current) return; lock(900); goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault(); if (lockRef.current) return; lock(900); goTo(TOTAL - 1)
      } else if (e.key === 'Escape') {
        onBackRef.current()
      }
    }
    const onTouchStart = (e: TouchEvent) => { touchY.current = e.touches[0].clientY }
    const onTouchEnd   = (e: TouchEvent) => {
      if (lockRef.current) return
      const dy = touchY.current - e.changedTouches[0].clientY
      if (Math.abs(dy) < 40) return
      lock()
      goTo(indexRef.current + (dy > 0 ? 1 : -1))
    }

    c.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    c.addEventListener('touchstart', onTouchStart, { passive: true })
    c.addEventListener('touchend',   onTouchEnd,   { passive: true })
    // scrollend は Chrome 114+ / Firefox 109+ / Safari 18+ で利用可
    c.addEventListener('scrollend', onScrollEnd)
    return () => {
      c.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      c.removeEventListener('touchstart', onTouchStart)
      c.removeEventListener('touchend',   onTouchEnd)
      c.removeEventListener('scrollend', onScrollEnd)
      // unmount 時のみ clear (mount-only effect なので翻頁時には呼ばれない)
      if (unlockTimerRef.current != null) {
        window.clearTimeout(unlockTimerRef.current)
        unlockTimerRef.current = null
      }
    }
  }, [lock, goTo])

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
        {/* mounted を active に合算 — 初回 mount 時に false→true 遷移を作って
            traveler / dots の CSS transition を確実に発火させる (#bug)。
            他ページは index 切替で false→true が自然に起こるため不要。 */}
        <PageNames    active={mounted && index === 0} isMobile={isMobile} />
        <PageOtherMap active={index === 1} isMobile={isMobile} />
        <PageYourTurn active={index === 2} onEnter={enter} isMobile={isMobile} />
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
        /* 飘る一人の旅人 — 上から落下、中央で短く滞在、最後に消失 */
        @keyframes tcmFallingTraveler {
          0%   { top: 12%; opacity: 0; }
          10%  { opacity: 1; }
          65%  { top: 52%; opacity: 1; }
          100% { top: 52%; opacity: 0; }
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
      minHeight: '100dvh', maxHeight: '100dvh',
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

// ─── 1 · 知らない名前 — city light dots scatter + AI 対比 ────────────────
function PageNames({ active, isMobile }: { active: boolean; isMobile: boolean }) {
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
    <Page active={active} isMobile={isMobile} n="一" en="I · A Sea of Names" jp="知らない名前">
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
        {/* one falling traveler — 飄り → 停顿 → 消失 の 1 ショット
            key で active 切替時に animation を再起動（page 2 から戻った時にもう一度発火） */}
        <span
          key={active ? 'traveler-on' : 'traveler-off'}
          style={{
            position: 'absolute', left: '52%', top: '12%',
            width: 6, height: 6, borderRadius: 999, background: STORY_RED,
            boxShadow: '0 0 18px rgba(168,51,43,.55)',
            opacity: 0,
            animation: active
              ? 'tcmFallingTraveler 4s cubic-bezier(.4,.0,.2,1) .3s forwards'
              : 'none',
          }}
        />
      </div>
      <div style={{
        position: 'relative',
        maxWidth: isMobile ? '100%' : 580,
        fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
        fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
        lineHeight: isMobile ? 2 : 2.25,
        letterSpacing: '.08em', color: STORY_INK,
        // frosted glass — Welcome の参数を米色基底に翻訳（0.32 / blur 28px）。
        // 背景の散点 + 飘る traveler は強くぼかされつつ色味は透けて見える editorial 感。
        background: 'rgba(243,236,221,.32)',
        backdropFilter: 'blur(28px) saturate(120%)',
        WebkitBackdropFilter: 'blur(28px) saturate(120%)',
        padding: isMobile ? '22px 22px' : '34px 40px',
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.2s .9s, transform 1.2s .9s',
      }}>
        <p style={{ margin: '0 0 .35em' }}>東京と、その周りに、1843の駅がある。</p>
        <p style={{ margin: '0 0 .35em' }}>夜の灯は、名前の海のように広がっている。</p>
        <p style={{ margin: '.7em 0 .35em', color: STORY_DIM, fontStyle: 'italic' }}>
          引っ越し先を、ネットで調べてみる——
        </p>
        <p style={{ margin: '0 0 .35em' }}>「渋谷まで30分、家賃7万円」</p>
        <p style={{ margin: '0 0 .35em' }}>画面には、見知らぬ駅の名前が、ずらりと並ぶ。</p>
        <p style={{ margin: '.7em 0 0', color: STORY_RED }}>
          けれど、その駅で暮らす朝が、<br />どんな光で始まるのかは、<br />名前だけでは、わからない。
        </p>
      </div>
    </Page>
  )
}

// PageOtherMap 用の同心リング半径。module-level に置いて useMemo 依存性問題を回避。
const OTHER_MAP_RINGS = [70, 130, 210, 300, 400, 510]

// ─── 2 · もうひとつの地図 — isochrone rings + 駅の色点 ────────────────────
function PageOtherMap({ active, isMobile }: { active: boolean; isMobile: boolean }) {
  const ringTransform = isMobile ? 'translate(500, 540)' : 'translate(680, 320)'

  // 駅の色点 — 通勤時間によって色を変える。
  // 各リング上に等角分布 + オフセットで決定論的に配置（mutable PRNG を避け
  // React の immutability lint をパスする）。
  const stationDots = useMemo(() => {
    const palettes: string[][] = [
      ['#5e7044', '#84a16b'],  // ring 0 — green (近)
      ['#5e7044', '#84a16b'],  // ring 1
      ['#c9a35a', '#d7b870'],  // ring 2 — yellow (中)
      ['#c9a35a', '#d7b870'],  // ring 3
      ['#a8332b', '#c45a51'],  // ring 4 — red (遠)
      ['#a8332b', '#c45a51'],  // ring 5
    ]
    const dotsPerRing = 6
    return OTHER_MAP_RINGS.flatMap((radius, ringIdx) =>
      Array.from({ length: dotsPerRing }, (_, j) => {
        const baseAngle = (j / dotsPerRing) * Math.PI * 2
        const offset    = (ringIdx * 0.37 + j * 0.13) % (Math.PI * 2)
        const angle     = baseAngle + offset
        return {
          dx:    Math.cos(angle) * radius,
          dy:    Math.sin(angle) * radius * 0.7,  // 楕円扁平で地図感
          color: palettes[ringIdx][j % palettes[ringIdx].length],
          d:     0.3 + ((j + ringIdx) % 5) * 0.15,
          r:     3 + ((j + ringIdx * 2) % 3),
        }
      })
    )
  }, [])

  return (
    <Page active={active} isMobile={isMobile} n="二" en="II · The Other Map" jp="もうひとつの地図">
      <svg aria-hidden viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: active ? 1 : 0, transition: 'opacity 1s',
        }}>
        <g transform={ringTransform}>
          {OTHER_MAP_RINGS.map((r, i) => (
            <circle key={i} cx="0" cy="0" r={r}
              fill="none" stroke={STORY_RED} strokeWidth=".6"
              strokeDasharray={2 * Math.PI * r}
              strokeDashoffset={active ? 0 : 2 * Math.PI * r}
              opacity={0.55 - i * 0.06}
              style={{ transition: `stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.18}s` }}
            />
          ))}
          {/* 駅の色点 — 通勤時間で色を変える */}
          {stationDots.map((dot, i) => (
            <circle key={`s-${i}`}
              cx={dot.dx} cy={dot.dy} r={dot.r}
              fill={dot.color}
              opacity={active ? 0.88 : 0}
              style={{
                transition: `opacity 0.7s cubic-bezier(.2,.8,.2,1) ${1.4 + dot.d}s`,
              }}
            />
          ))}
          {/* 中心の目的地 */}
          <circle cx="0" cy="0" r="5" fill={STORY_INK}
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
        <p style={{ margin: '0 0 .8em' }}>通勤時間で、地図が色を変えていく。</p>
        <p style={{ margin: '0 0 .35em' }}>1843の駅が、あなたから何分の場所にあるのかを語りはじめる。</p>
        <p style={{ margin: '0', color: STORY_DIM }}>近い駅は緑、遠い駅は朱。</p>
      </div>
    </Page>
  )
}

// ─── 終 · あなたの番 — minute clock + CTA ────────────────────────────────
function PageYourTurn({ active, onEnter, isMobile }: { active: boolean; onEnter: () => void; isMobile: boolean }) {
  const minutes = Array.from({ length: 60 })
  return (
    <Page active={active} isMobile={isMobile} n="終" en="Coda · Your Turn" jp="あなたの番">
      {/* minute clock — 時計の針が「いまから」のはじまりを暗示 */}
      <div aria-hidden style={{
        position: 'absolute',
        left: isMobile ? 'auto' : '8%',
        right: isMobile ? '6%' : 'auto',
        top: isMobile ? '14vh' : '50%',
        transform: isMobile ? 'none' : 'translateY(-50%)',
        width: isMobile ? 'min(28vw, 130px)' : 'min(36vh, 32vw)',
        aspectRatio: '1/1',
        opacity: active ? (isMobile ? 0.45 : 0.9) : 0,
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
        textAlign: isMobile ? 'left' : 'right',
        maxWidth: isMobile ? '100%' : 540,
        marginTop: isMobile ? '6vh' : '2vh',
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 1.2s .5s, transform 1.2s .5s',
      }}>
        <p style={{
          margin: isMobile ? '0 0 24px' : '0 0 30px',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(14px, 4.2vw, 17px)' : 'clamp(18px, 1.55vw, 22px)',
          lineHeight: isMobile ? 2 : 2.2,
          letterSpacing: '.08em', color: STORY_INK,
        }}>
          ここからは、<br />
          <span style={{ color: STORY_RED }}>あなたの番。</span>
        </p>

        {/* 大見出しの折り返し守則 ── 句読点ごとに <span whiteSpace:nowrap> で分割し、
            「行こ／う。」のような孤字断行を防止する。textWrap: balance は CJK では信頼
            できないため使わず、span 単位の nowrap で制御。
            将来この文案を差し替える際も、各句を nowrap span で包む構造を維持すること。 */}
        <h2 style={{
          margin: isMobile ? '0 0 22px' : '0 0 28px',
          fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",serif)',
          fontStyle: 'italic', fontWeight: 400,
          fontSize: isMobile ? 'clamp(24px, 7.2vw, 38px)' : 'clamp(32px, 4vw, 56px)',
          lineHeight: isMobile ? 1.2 : 1.15,
          letterSpacing: '-.012em', color: STORY_INK,
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>自分の足で、</span>
          <br />
          <span style={{ whiteSpace: 'nowrap' }}>自分のまちを</span>
          <span style={{ whiteSpace: 'nowrap' }}>見つけに行こう。</span>
        </h2>

        <p style={{
          margin: isMobile ? '0 0 30px' : '0 0 40px',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: isMobile ? 'clamp(12px, 3.5vw, 14px)' : 'clamp(14px, 1.2vw, 16px)',
          lineHeight: isMobile ? 1.85 : 1.95,
          letterSpacing: '.06em', color: STORY_DIM,
        }}>
          東京には、きっとまだ、<br />
          あなたの知らない、あなただけの1駅がある。<br />
          AIも、口コミも、道しるべに過ぎない。<br />
          画面をスクロールするたび、<br />
          動き出すのは、あなたの好奇心。
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
          地図を開く →
        </button>

        <div style={{
          marginTop: isMobile ? 18 : 26,
          fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
          fontSize: isMobile ? 9 : 10,
          letterSpacing: '.32em', color: '#a89c82',
        }}>
          1843 stations · waiting
        </div>
      </div>
    </Page>
  )
}
