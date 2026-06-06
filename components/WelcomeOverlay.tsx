'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useIsMobile } from '@/lib/useIsMobile'
import { STORAGE_KEYS } from '@/lib/storage-keys'

interface Props {
  onEnterMap: () => void
  onEnterStory: () => void
}

// Subtitle はブランド表記なので翻訳しない (Kayoha = ローマ字主品牌、通葉 = 漢字徽章)。
const SUBTITLE_TEXT = 'Kayoha — 通葉'

// smoke card chrome — 暗烟玻璃 + 米色字（design 原型 cardStyle='smoke'）
const INK     = '#f5e7d2'   // 主字
const INK_S   = '#d8c7a8'   // 副字
const INK_M   = '#a89c82'   // mute 字
const BTN_FILL_BG = '#f5e7d2'
const BTN_FILL_FG = '#1c1812'
const BTN_GHOST_FG = '#f5e7d2'
const BTN_GHOST_HOVER = 'rgba(245,231,210,.12)'

export default function WelcomeOverlay({ onEnterMap, onEnterStory }: Props) {
  const t = useTranslations('welcome')
  const locale = useLocale()
  const TITLE_TEXT = t('tagline')
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [phase, setPhase] = useState<'hero' | 'confirm'>('hero')

  // smoothed mouse for spring-damped parallax
  const [smouse, setSmouse] = useState({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  // typewriter
  const [titleTyped, setTitleTyped] = useState(0)
  const [titleDone, setTitleDone] = useState(false)

  // video freeze-on-last-frame
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const freezeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [videoFrozen, setVideoFrozen] = useState(false)

  // mount + spring loop + typewriter + phase transition
  useEffect(() => {
    const mountId = requestAnimationFrame(() => setMounted(true))

    let rafId = 0
    const tick = () => {
      const t = targetRef.current
      const c = currentRef.current
      c.x += (t.x - c.x) * 0.08
      c.y += (t.y - c.y) * 0.08
      setSmouse({ x: c.x, y: c.y })
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const TITLE_START = 600
    // ラテン文字 locale (en) は文字数が CJK の約 3 倍になるため、1 文字あたりの
    // step を縮めて合計タイピング時間を CJK と同程度（~0.9-1.4s）に揃える。
    const TITLE_STEP = TITLE_TEXT.length > 20 ? 40 : 75
    const SUB_FADE = 1400 // subtitle fade-in after title done

    const titleTimers: number[] = []
    for (let i = 1; i <= TITLE_TEXT.length; i++) {
      titleTimers.push(
        window.setTimeout(() => setTitleTyped(i), TITLE_START + i * TITLE_STEP)
      )
    }
    const titleDoneT = window.setTimeout(
      () => setTitleDone(true),
      TITLE_START + TITLE_TEXT.length * TITLE_STEP + 200
    )
    // hero phase: title typing + subtitle fade + linger ~1.8s → confirm
    const phaseT = window.setTimeout(
      () => setPhase('confirm'),
      TITLE_START + TITLE_TEXT.length * TITLE_STEP + 200 + SUB_FADE + 1800
    )

    return () => {
      cancelAnimationFrame(mountId)
      cancelAnimationFrame(rafId)
      titleTimers.forEach(clearTimeout)
      clearTimeout(titleDoneT)
      clearTimeout(phaseT)
    }
  }, [])

  // mobile Safari blocks muted autoplay until a user gesture
  const tryPlayOnGesture = useCallback(() => {
    const v = videoRef.current
    if (v && v.paused && v.currentTime < 0.05 && !v.dataset.gestured) {
      v.dataset.gestured = '1'
      v.playbackRate = 0.7
      v.play().catch(() => {})
    }
  }, [])

  function handleMouse(e: React.MouseEvent) {
    const w = window.innerWidth
    const h = window.innerHeight
    const nx = (e.clientX / w - 0.5) * 2
    const ny = (e.clientY / h - 0.5) * 2
    targetRef.current = { x: nx, y: ny }
    tryPlayOnGesture()
  }

  // closeWith — fade out 動画を始めると同時に親コンポーネントへ通知。
  // 親が次の画面（Map / Story）を即座にマウントできるよう、setTimeout で
  // 待たずに cb を即実行する。Welcome 自身は z-index 100 で最前面に残り、
  // opacity が 1 → 0 する間に下のレイヤーがフェードインを完了する。
  const closeWith = useCallback(
    (cb: () => void) => {
      if (closing) return
      setClosing(true)
      cb()
    },
    [closing]
  )

  const handlePrimary = useCallback(() => closeWith(onEnterMap), [closeWith, onEnterMap])
  const handleGhost   = useCallback(() => closeWith(onEnterStory), [closeWith, onEnterStory])

  // attach video event handlers once
  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (!el || el.dataset.init) return
    el.dataset.init = '1'
    el.playbackRate = 0.7

    let frozen = false
    let rafId = 0
    const FREEZE_OFFSET = 0.4

    const tryPlay = () => {
      el.playbackRate = 0.7
      const p = el.play()
      if (p && p.catch) p.catch(() => {})
    }

    const freezeToCanvas = () => {
      if (frozen) return
      frozen = true
      const cv = freezeCanvasRef.current
      if (cv && el.videoWidth && el.videoHeight) {
        cv.width = el.videoWidth
        cv.height = el.videoHeight
        try {
          const ctx = cv.getContext('2d')
          ctx?.drawImage(el, 0, 0, cv.width, cv.height)
          setVideoFrozen(true)
        } catch {}
      }
      el.pause()
    }

    const watch = () => {
      if (frozen) return
      if (
        isFinite(el.duration) &&
        el.duration > 0 &&
        el.currentTime >= el.duration - FREEZE_OFFSET
      ) {
        freezeToCanvas()
        return
      }
      rafId = requestAnimationFrame(watch)
    }

    el.addEventListener('loadedmetadata', () => {
      el.playbackRate = 0.7
      tryPlay()
    })
    el.addEventListener('loadeddata', tryPlay)
    el.addEventListener('canplay', () => {
      if (el.paused && !frozen) tryPlay()
    })
    el.addEventListener('canplaythrough', () => {
      if (el.paused && !frozen) tryPlay()
    })
    el.addEventListener('play', () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(watch)
    })
    el.addEventListener('timeupdate', () => {
      if (frozen) return
      if (
        isFinite(el.duration) &&
        el.currentTime >= el.duration - FREEZE_OFFSET
      ) {
        freezeToCanvas()
      }
    })
    el.addEventListener('ended', () => {
      if (frozen) return
      try {
        el.currentTime = Math.max(0, (el.duration || 0) - 0.05)
      } catch {}
      setTimeout(freezeToCanvas, 60)
    })

    try {
      el.load()
    } catch {}
    tryPlay()
  }, [])

  return (
    <div
      onMouseMove={handleMouse}
      onTouchStart={tryPlayOnGesture}
      onPointerDown={tryPlayOnGesture}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflow: 'hidden',
        background: '#000',
        opacity: closing ? 0 : 1,
        transition: 'opacity .9s cubic-bezier(.2,.8,.2,1)',
        fontFamily: 'var(--ui-font, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* ── BACKGROUND VIDEO (full-bleed) ──────────────── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
        {/* canvas — gets painted with the video's last frame */}
        <canvas
          ref={freezeCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate3d(${-smouse.x * 18}px, ${-smouse.y * 12}px, 0) scale(${
              mounted ? 1.02 : 1.06
            })`,
            transition: 'transform 1.6s cubic-bezier(.2,.8,.2,1)',
            filter: 'saturate(1.05) brightness(1.02)',
            opacity: videoFrozen ? 1 : 0,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={setVideoEl}
          poster="/welcome-poster.jpg"
          muted
          playsInline
          autoPlay
          preload="metadata"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate3d(${-smouse.x * 18}px, ${-smouse.y * 12}px, 0) scale(${
              mounted ? 1.02 : 1.06
            })`,
            transition:
              'transform 1.6s cubic-bezier(.2,.8,.2,1), filter 1.6s cubic-bezier(.2,.8,.2,1), opacity 2.4s cubic-bezier(.4,0,.2,1)',
            filter: mounted
              ? 'saturate(1.05) brightness(1.02)'
              : 'saturate(.5) brightness(.85) blur(8px)',
            opacity: mounted && !videoFrozen ? 1 : 0,
            willChange: 'transform',
          }}
        >
          {/* VP9 (-60%、896KB) を優先、未対応ブラウザは H.264 に fallback */}
          <source src="/welcome-bg.webm" type="video/webm" />
          <source src="/welcome-bg.mp4" type="video/mp4" />
        </video>

        {/* parallax floating particles */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            transform: `translate3d(${smouse.x * 22}px, ${smouse.y * 14}px, 0)`,
            transition: 'transform 1.2s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {Array.from({ length: 14 }).map((_, i) => {
            const x = (i * 137) % 100
            const y = (i * 211) % 100
            const s = 0.8 + (i % 3) * 0.4
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  width: s * 3,
                  height: s * 3,
                  borderRadius: '50%',
                  background: '#fff5e0',
                  opacity: 0.35,
                  animation: `welcomeParticleFloat ${20 + i * 1.7}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ── soft vignette ─────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(20,15,8,.18) 100%)',
        }}
      />

      {/* ── language toggle (top-right) ───────────────── */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 14 : 28,
          right: isMobile ? 16 : 36,
          zIndex: 5,
          display: 'flex',
          gap: isMobile ? 10 : 14,
          fontFamily: 'var(--mono, ui-monospace, monospace)',
          fontSize: isMobile ? 10 : 11,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: INK_S,
          textShadow: '0 1px 8px rgba(0,0,0,.5)',
        }}
      >
        <LocaleLink locale="ja" active={locale === 'ja'} label="JA" inkActive={INK_S} inkIdle={INK_M} />
        <LocaleLink locale="zh" active={locale === 'zh'} label="ZH" inkActive={INK_S} inkIdle={INK_M} />
        <LocaleLink locale="en" active={locale === 'en'} label="EN" inkActive={INK_S} inkIdle={INK_M} />
      </div>

      {/* ── brand mark (top-left): Kayoha + 通葉 ────────── */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 14 : 28,
          left: isMobile ? 16 : 36,
          zIndex: 5,
          color: INK_S,
          textShadow: '0 1px 8px rgba(0,0,0,.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1.1,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-cormorant), "Cormorant Garamond", serif',
          fontSize: isMobile ? 20 : 26,
          fontWeight: 400,
          letterSpacing: '.06em',
        }}>Kayoha</span>
        <span style={{
          fontFamily: 'var(--font-shippori), "Shippori Mincho", serif',
          fontSize: isMobile ? 9 : 11,
          fontWeight: 600,
          color: '#a8332b',
          letterSpacing: '.3em',
          marginTop: 2,
        }}>通葉</span>
      </div>

      {/* ── center card (smoke style) ─────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4,
          padding: isMobile ? '0 16px' : '0 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: isMobile
              ? '100%'
              : (phase === 'hero' ? 920 : 440),
            textAlign: 'center',
            color: INK,
            padding: isMobile
              ? (phase === 'hero' ? '36px 22px 32px' : '20px 18px 18px')
              : (phase === 'hero' ? '56px 64px 52px' : '24px 28px 22px'),
            background: 'rgba(20, 15, 10, 0.32)',
            backdropFilter: 'blur(28px) saturate(120%)',
            WebkitBackdropFilter: 'blur(28px) saturate(120%)',
            border: '.5px solid rgba(245,231,210,.14)',
            boxShadow: '0 24px 80px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,245,225,.10)',
            borderRadius: 0,
            transform: mounted && !closing ? 'translateY(0)' : 'translateY(20px)',
            opacity: mounted && !closing ? 1 : 0,
            transition: [
              'opacity .9s cubic-bezier(.2,.8,.2,1) .15s',
              'transform .9s cubic-bezier(.2,.8,.2,1) .15s',
              'max-width 1.1s cubic-bezier(.65,0,.35,1) .25s',
              'padding 1.1s cubic-bezier(.65,0,.35,1) .25s',
            ].join(', '),
          }}
        >
          {/* tiny floral mark */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 24,
              color: INK_M,
              transition: 'color .8s cubic-bezier(.65,0,.35,1)',
            }}
          >
            <span style={{ width: 36, height: '.5px', background: 'currentColor' }} />
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="2" fill="currentColor" />
              <circle cx="7" cy="2" r="1.5" fill="none" stroke="currentColor" strokeWidth=".7" />
              <circle cx="7" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth=".7" />
              <circle cx="2" cy="7" r="1.5" fill="none" stroke="currentColor" strokeWidth=".7" />
              <circle cx="12" cy="7" r="1.5" fill="none" stroke="currentColor" strokeWidth=".7" />
            </svg>
            <span style={{ width: 36, height: '.5px', background: 'currentColor' }} />
          </div>

          {/* phase content area (hero / confirm cross-fade) */}
          <div
            style={{
              position: 'relative',
              minHeight: isMobile
                ? (phase === 'hero' ? 260 : 170)
                : (phase === 'hero' ? 420 : 200),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              transition: 'min-height 1.1s cubic-bezier(.65,0,.35,1) .25s',
            }}
          >
            {/* PHASE 1 — title + subtitle */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 28,
                opacity: phase === 'hero' ? 1 : 0,
                transform: phase === 'hero' ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(.985)',
                filter: phase === 'hero' ? 'blur(0)' : 'blur(2px)',
                transition:
                  'opacity .55s cubic-bezier(.4,0,.2,1), transform .8s cubic-bezier(.4,0,.2,1), filter .55s cubic-bezier(.4,0,.2,1)',
                pointerEvents: phase === 'hero' ? 'auto' : 'none',
                willChange: 'opacity, transform, filter',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--display-italic, "Cormorant Garamond","Shippori Mincho",Garamond,serif)',
                  // 中文では italic 概念が無く、強制斜体は破綻するため normal + SemiBold で
                  // 視覚的重みを補い、letter-spacing も方塊字向けに positive 寄せ。
                  fontWeight: locale === 'zh' ? 500 : 400,
                  fontStyle: locale === 'zh' ? 'normal' : 'italic',
                  fontSize: isMobile ? 'clamp(28px, 9vw, 44px)' : 'clamp(44px, 6vw, 88px)',
                  lineHeight: locale === 'zh' ? 1.25 : 1.1,
                  letterSpacing: locale === 'zh' ? '.04em' : '-.015em',
                  color: INK,
                  textWrap: 'balance' as React.CSSProperties['textWrap'],
                  minHeight: '1.1em',
                  padding: isMobile ? '0 4px' : 0,
                }}
              >
                <span>{TITLE_TEXT.slice(0, titleTyped)}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '.06em',
                    height: '.95em',
                    marginLeft: '.04em',
                    verticalAlign: '-0.08em',
                    background: INK,
                    opacity: titleDone ? 0 : 1,
                    animation: 'welcomeCaretBlink 1s steps(1) infinite',
                    transition: 'opacity .4s',
                  }}
                />
              </h1>

              <p
                style={{
                  margin: 0,
                  maxWidth: isMobile ? '100%' : 520,
                  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                  fontSize: isMobile ? 'clamp(13px, 4vw, 16px)' : 'clamp(15px, 1.4vw, 19px)',
                  lineHeight: 1.85,
                  color: INK_S,
                  letterSpacing: '.06em',
                  padding: isMobile ? '0 8px' : 0,
                  opacity: titleDone ? 1 : 0,
                  transform: titleDone ? 'translateY(0)' : 'translateY(12px)',
                  transition: 'opacity 1.1s ease-out, transform 1.1s ease-out',
                }}
              >
                {SUBTITLE_TEXT}
              </p>
            </div>

            {/* PHASE 2 — confirmation + CTAs */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 28,
                opacity: phase === 'confirm' ? 1 : 0,
                transform: phase === 'confirm' ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.985)',
                filter: phase === 'confirm' ? 'blur(0)' : 'blur(2px)',
                transition: phase === 'confirm'
                  ? 'opacity .7s cubic-bezier(.4,0,.2,1) .65s, transform .8s cubic-bezier(.4,0,.2,1) .65s, filter .7s cubic-bezier(.4,0,.2,1) .65s'
                  : 'opacity .35s cubic-bezier(.4,0,.2,1), transform .5s cubic-bezier(.4,0,.2,1), filter .35s cubic-bezier(.4,0,.2,1)',
                pointerEvents: phase === 'confirm' ? 'auto' : 'none',
                willChange: 'opacity, transform, filter',
              }}
            >
              <div
                style={{
                  maxWidth: isMobile ? '100%' : 380,
                  fontFamily: 'var(--ui-font, system-ui, -apple-system, sans-serif)',
                  fontSize: isMobile ? 12.5 : 14,
                  lineHeight: 1.8,
                  color: INK_S,
                  textAlign: 'center',
                  padding: isMobile ? '0 4px' : 0,
                }}
              >
                {t('consentLead')}
                <br />
                <strong style={{ fontWeight: 600 }}>
                  {t('consentBold')}
                </strong>
                {t('consentTail')}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: isMobile ? 10 : 14,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                <button
                  onClick={handlePrimary}
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    padding: isMobile ? '12px 20px' : '14px 32px',
                    border: `.5px solid ${BTN_FILL_BG}`,
                    background: BTN_FILL_BG,
                    color: BTN_FILL_FG,
                    fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                    fontWeight: 600,
                    fontSize: isMobile ? 13 : 14,
                    letterSpacing: '.04em',
                    borderRadius: 0,
                    whiteSpace: 'nowrap',
                    flex: isMobile ? '1 1 0' : 'none',
                    // en など長いラベルが等分幅 (basis 0) を超える場合は flexWrap で
                    // 縦積みに退避させる（nowrap のままはみ出させない）。
                    minWidth: isMobile ? 'fit-content' : undefined,
                    transition: 'all .25s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#a8332b'
                    e.currentTarget.style.borderColor = '#a8332b'
                    e.currentTarget.style.color = '#f5e7d2'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = BTN_FILL_BG
                    e.currentTarget.style.borderColor = BTN_FILL_BG
                    e.currentTarget.style.color = BTN_FILL_FG
                  }}
                >
                  {t('openMap')}
                </button>
                <button
                  onClick={handleGhost}
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    padding: isMobile ? '12px 20px' : '14px 32px',
                    border: `.5px solid ${BTN_GHOST_FG}`,
                    background: 'transparent',
                    color: BTN_GHOST_FG,
                    fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                    fontWeight: 600,
                    fontSize: isMobile ? 13 : 14,
                    letterSpacing: '.04em',
                    borderRadius: 0,
                    whiteSpace: 'nowrap',
                    flex: isMobile ? '1 1 0' : 'none',
                    minWidth: isMobile ? 'fit-content' : undefined,
                    transition: 'all .25s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = BTN_GHOST_HOVER
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {t('readStory')}
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 36,
              fontFamily: 'var(--mono, ui-monospace, monospace)',
              fontSize: 10,
              letterSpacing: '.2em',
              color: INK_M,
              textTransform: 'uppercase',
              opacity: phase === 'confirm' ? 1 : 0,
              transition: 'opacity .8s ease-out .3s',
            }}
          >
            Scroll · Tap · Listen
          </div>
        </div>
      </div>

      {/* ── footer line ───────────────────────────────── */}
      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 36,
            right: 36,
            zIndex: 5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'var(--mono, ui-monospace, monospace)',
            fontSize: 10,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: INK_S,
            textShadow: '0 1px 8px rgba(0,0,0,.5)',
          }}
        >
          <span>Sora · Mura · Eki</span>
          <span style={{ display: 'flex', gap: 22 }}>
            <span>{t('footerStory')}</span>
            <span>{t('footerRoutes')}</span>
            <span>{t('footerReviews')}</span>
          </span>
        </div>
      )}
    </div>
  )
}

// 言語切替リンク。`next-intl` の Link でも動くが、`onClick` prop が内部の click
// handler に呑まれて sessionStorage flag を立てる前に navigate されるケースを観測。
// `useRouter().replace({locale})` を明示的に呼び、flag → navigate の順序を保証する。
// `router.replace(...)` は内部で NEXT_LOCALE cookie も同時更新する。
function LocaleLink({
  locale,
  active,
  label,
  inkActive,
  inkIdle,
}: {
  locale: 'ja' | 'zh' | 'en'
  active: boolean
  label: string
  inkActive: string
  inkIdle: string
}) {
  const router = useRouter()
  return (
    <a
      // href を実物 URL にしておくと右クリック「新しいタブで開く」/ middle-click も動く。
      // as-needed mode で ja は prefix 無し、zh は /zh。
      href={locale === 'ja' ? '/' : `/${locale}`}
      onClick={(e) => {
        // 左クリック + 修飾キー無しのみ SPA navigation を奪う。それ以外（Cmd+Click 等）は
        // ブラウザ標準動作に任せる。
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        // Welcome 上で切替 → reload 後も Welcome に留めるため sessionStorage flag を立てる。
        // page.tsx の mount 時に読まれ、visited に関わらず Welcome を再表示し flag は即削除。
        // tab 限定の flag なので別 tab / 後日の通常訪問には影響しない。
        try { sessionStorage.setItem(STORAGE_KEYS.welcomeAfterLocaleSwitch, '1') } catch {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace('/' as any, { locale })
      }}
      style={{
        color: active ? inkActive : inkIdle,
        textDecoration: 'none',
        borderBottom: active ? `.5px solid ${inkActive}` : 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </a>
  )
}
