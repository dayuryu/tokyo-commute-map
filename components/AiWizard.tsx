'use client'

/**
 * AI 駅推薦 Wizard。
 *
 * 流れ:
 *   DestinationAsk で通勤先確定 + AI ボタン押下
 *     → Wizard mount、destination は props で固定
 *     → Q1..Q5 を「一問一屏」editorial スクロール感覚で進行
 *     → 5 問終了 → loading → /api/recommend POST → result（AiResultGrid）
 *     → カードクリック: onResolve(destination, station_name) で
 *                      ペアレントに最終駅名を通知、Wizard を閉じる
 *     → CTA: onClose() で Wizard 閉じ + 地図へ戻る
 *
 * destination は fixed slug 限定（custom destination は呼出側で blocking）。
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  QUICK_DESTINATIONS,
  POPULAR_DESTINATIONS,
  getDestinationDisplayName,
  type FixedDestination,
} from '@/lib/destinations'
import type {
  Atmosphere,
  CommuteMaxMinutes,
  Household,
  Recommendation,
  RecommendApiResponse,
  RentMax,
  SafetyPriority,
  WizardAnswers,
} from '@/lib/ai-recommend/types'
import AiResultGrid from './AiResultGrid'

const BG  = '#f3ecdd'
const INK = '#1c1812'
const RED = '#a8332b'
const DIM = '#7d7060'

// ── デバイス ID（StationDrawer と共通 key） ───────────────────────
function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = ''
  try {
    id = localStorage.getItem(key) ?? ''
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
  } catch {
    // Private browsing 等で localStorage 不可 → 一時 UUID（rate limit は IP で代用）
    id = crypto.randomUUID()
  }
  return id
}

// ── 質問定義 ─────────────────────────────────────────────────────
type AnswerValue = CommuteMaxMinutes | RentMax | Household | Atmosphere | SafetyPriority

type QuestionDef = {
  key:     keyof Omit<WizardAnswers, 'destination'>
  prelude: string  // italic Garamond
  title:   string  // 明朝大字
  options: { value: AnswerValue; label: string }[]
}

const QUESTIONS: QuestionDef[] = [
  {
    key:     'maxMinutes',
    prelude: 'how much time can you give?',
    title:   '通勤時間の上限は？',
    options: [
      { value: 30, label: '30 分以内' },
      { value: 45, label: '45 分以内' },
      { value: 60, label: '60 分以内' },
      { value: 90, label: '90 分以内' },
    ],
  },
  {
    key:     'rentMax',
    prelude: 'and your rent ceiling?',
    title:   '家賃の上限は？（月額）',
    options: [
      { value: '~7万',    label: '〜 7 万円' },
      { value: '7-10万',  label: '7 〜 10 万円' },
      { value: '10-15万', label: '10 〜 15 万円' },
      { value: '15万+',   label: '15 万円以上' },
    ],
  },
  {
    key:     'household',
    prelude: 'who are you living with?',
    title:   'ご家族構成は？',
    options: [
      { value: '単身',     label: '単身' },
      { value: 'カップル', label: 'カップル' },
      { value: '子持ち',   label: '子持ち' },
    ],
  },
  {
    key:     'atmosphere',
    prelude: 'what kind of street?',
    title:   '街の雰囲気は？',
    options: [
      { value: '賑やか',       label: '賑やか' },
      { value: '落ち着いた',   label: '落ち着いた' },
      { value: '緑が多い',     label: '緑が多い' },
      { value: '商業集中',     label: '商業集中' },
    ],
  },
  {
    key:     'safety',
    prelude: 'how much does safety matter?',
    title:   '治安はどれくらい重視？',
    options: [
      { value: '最重要',       label: '最重要' },
      { value: '普通',         label: '普通' },
      { value: '気にしない',   label: '気にしない' },
    ],
  },
]

// ── Wizard 状態 ──────────────────────────────────────────────────
// step が 0 のときは destination 選択画面（QUESTIONS[0] = destination）。
// step が 1〜5 のときは QUESTIONS[step] の通常設問。
type WizardState =
  | { phase: 'q'; index: number }
  | { phase: 'loading' }
  | { phase: 'result'; recs: Recommendation[]; isFallback?: boolean; isCached?: boolean }
  | { phase: 'error'; message: string; canRetry: boolean }

interface Props {
  /** 任意 — DestinationAsk 等で既に通勤先が決まっていれば Q1 に予選択しておく */
  initialDestination?: FixedDestination
  /**
   * キャッシュされた過去の推薦結果。提供されれば Q1-Q6 / loading をスキップして
   * 直接 result phase で起動する（24h 以内の「もう一度見る」フロー用）。
   */
  cachedResult?: {
    recs:        Recommendation[]
    destination: FixedDestination
  }
  /**
   * Wizard を閉じる。
   * destination は Wizard 内で選択された通勤先（Q1 まで進んでいない場合は null）。
   * 親側はこれを受けて地図を mount し、Map 表示に切替える。
   */
  onClose:             (destination: FixedDestination | null) => void
  /**
   * 結果カードクリック時。destination + 該当駅名を親に通知。
   * 親側は地図を mount + 該当駅の drawer を開く。
   */
  onResolve:           (destination: FixedDestination, stationName: string) => void
  /**
   * OpenAI 真調用 / fallback / cache 命中いずれかで result が確定した瞬間に呼ばれる。
   * 親側は recs + destination を保存して、後で AiRecallButton から再表示できるようにする。
   * cachedResult から起動した場合は呼ばれない（既に親側に存在しているため）。
   */
  onResultReady?:      (destination: FixedDestination, recs: Recommendation[]) => void
}

export default function AiWizard({
  initialDestination,
  cachedResult,
  onClose,
  onResolve,
  onResultReady,
}: Props) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  // cachedResult があれば即 result phase（リコール経路）。
  // それ以外は Q1 (destination) または initialDestination で Q2 から開始。
  const [state, setState] = useState<WizardState>(
    cachedResult
      ? { phase: 'result', recs: cachedResult.recs, isCached: true }
      : { phase: 'q', index: initialDestination ? 1 : 0 }
  )
  // 部分答案累積（partial - 最後の質問まではすべて埋まっていない）
  const partialRef = useRef<Partial<WizardAnswers>>(
    cachedResult
      ? { destination: cachedResult.destination }
      : initialDestination ? { destination: initialDestination } : {}
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    if (closing) return
    setClosing(true)
    const dest = (partialRef.current.destination as FixedDestination | undefined) ?? null
    window.setTimeout(() => onClose(dest), 700)
  }

  // 結果カードクリック専用 — destination + 駅名を親に渡す
  function handleResolve(stationName: string) {
    if (closing) return
    setClosing(true)
    const dest = partialRef.current.destination as FixedDestination | undefined
    if (!dest) {
      // 防御的: destination 必須のはずだが万一無い場合は通常 close で fallback
      window.setTimeout(() => onClose(null), 700)
      return
    }
    window.setTimeout(() => onResolve(dest, stationName), 700)
  }

  function answerQuestion(value: AnswerValue | FixedDestination) {
    if (state.phase !== 'q') return
    if (state.index === 0) {
      // Q1: destination 選択
      partialRef.current.destination = value as FixedDestination
    } else {
      const q = QUESTIONS[state.index - 1]  // index 1..5 → QUESTIONS[0..4]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partialRef.current[q.key] = value as any
    }

    const next = state.index + 1
    // index 0 = destination, 1..5 = QUESTIONS[0..4] → 全 6 step
    if (next <= QUESTIONS.length) {
      setState({ phase: 'q', index: next })
    } else {
      // 全部回答 → loading
      void runRecommend()
    }
  }

  function back() {
    if (state.phase !== 'q' || state.index === 0) return
    setState({ phase: 'q', index: state.index - 1 })
  }

  // initialDestination がある場合 Q1 をスキップしているので「戻る」許可も index=2 から
  const minBackIndex = initialDestination ? 2 : 1

  async function runRecommend() {
    setState({ phase: 'loading' })
    const answers = partialRef.current as WizardAnswers
    const deviceId = getDeviceId()
    try {
      const res = await fetch('/api/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deviceId, ...answers }),
      })
      const data = (await res.json()) as RecommendApiResponse

      if (!data.ok) {
        const canRetry = res.status !== 429  // rate limit は再試行不可
        setState({
          phase: 'error',
          message: data.error || '推薦の取得に失敗しました。',
          canRetry,
        })
        return
      }
      setState({
        phase: 'result',
        recs: data.recommendations,
        isFallback: data.fallback,
        isCached: data.cached,
      })
      // 親側に recs + destination を通知（リコール用キャッシュ保存のため）。
      // cachedResult 起動の場合はここに来ない（loading をスキップしているため）。
      const dest = partialRef.current.destination as FixedDestination | undefined
      if (dest && onResultReady) {
        onResultReady(dest, data.recommendations)
      }
    } catch (e) {
      console.error('[AiWizard] /api/recommend failed:', e)
      setState({
        phase: 'error',
        message: 'ネットワークエラーが発生しました。',
        canRetry: true,
      })
    }
  }

  function retry() {
    void runRecommend()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: BG, color: INK,
        fontFamily: 'var(--display-font, "Shippori Mincho","Hiragino Mincho ProN",serif)',
        opacity: closing ? 0 : (mounted ? 1 : 0),
        transition: 'opacity .7s cubic-bezier(.2,.8,.2,1)',
        WebkitFontSmoothing: 'antialiased',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* paper warmth */}
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

      {/* close X */}
      <button
        onClick={handleClose}
        aria-label="close"
        style={{
          position: 'fixed', top: 18, right: 22, zIndex: 2,
          width: 36, height: 36,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: DIM,
          fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
          fontSize: 26, lineHeight: 1,
          transition: 'color .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = INK }}
        onMouseLeave={e => { e.currentTarget.style.color = DIM }}
      >
        ×
      </button>

      {/* content switch */}
      {state.phase === 'q' && state.index === 0 && (
        <DestinationView
          index={state.index}
          total={QUESTIONS.length + 1}
          isMobile={isMobile}
          onAnswer={answerQuestion}
          onExit={handleClose}
        />
      )}
      {state.phase === 'q' && state.index > 0 && (
        <QuestionView
          q={QUESTIONS[state.index - 1]}
          index={state.index}
          total={QUESTIONS.length + 1}
          destinationLabel={
            partialRef.current.destination
              ? getDestinationDisplayName(partialRef.current.destination as FixedDestination)
              : ''
          }
          isMobile={isMobile}
          onAnswer={answerQuestion}
          onBack={state.index < minBackIndex ? null : back}
        />
      )}
      {state.phase === 'loading'  && <LoadingView isMobile={isMobile} />}
      {state.phase === 'result'   && (
        <ResultView
          recs={state.recs}
          destinationLabel={
            partialRef.current.destination
              ? getDestinationDisplayName(partialRef.current.destination as FixedDestination)
              : ''
          }
          isFallback={state.isFallback}
          isCached={state.isCached}
          onStationClick={handleResolve}
          onCtaClick={handleClose}
        />
      )}
      {state.phase === 'error' && (
        <ErrorView
          message={state.message}
          canRetry={state.canRetry}
          onRetry={retry}
          onClose={handleClose}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

// ── Q1: 通勤先選択ビュー ──────────────────────────────────────────
// QUICK 3 駅 大ボタン + 「他から選ぶ」展開で POPULAR 27 駅 chip。
// DestinationAsk と視覚的に統一。
function DestinationView({
  index,
  total,
  isMobile,
  onAnswer,
  onExit,
}: {
  index:    number
  total:    number
  isMobile: boolean
  onAnswer: (value: FixedDestination) => void
  /** 30 駅に通勤先が無い user 向けの退出ハンドラ — Wizard を閉じて地図へ戻る */
  onExit:   () => void
}) {
  const [showMore, setShowMore] = useState(false)
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '90px 5vw 60px' : '8vh 6vw',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : 640,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* progress smallcaps */}
        <div
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '.4em', textTransform: 'uppercase',
            color: DIM,
            marginBottom: isMobile ? 14 : 18,
          }}
        >
          Question {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>

        {/* italic prelude */}
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 'clamp(18px, 5.4vw, 24px)' : 'clamp(24px, 2.6vw, 34px)',
            color: RED,
            margin: 0,
            letterSpacing: '-.01em',
            lineHeight: 1.15,
          }}
        >
          where do you commute?
        </p>

        {/* 主題 */}
        <h1
          style={{
            margin: isMobile ? '18px 0 30px' : '24px 0 40px',
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 'clamp(22px, 6.2vw, 30px)' : 'clamp(28px, 3.2vw, 40px)',
            lineHeight: 1.3,
            letterSpacing: '.06em',
            color: INK,
          }}
        >
          通勤先を一つ選んでください
        </h1>

        {/* QUICK 3 駅 — 大ボタン */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: isMobile ? 10 : 14,
            margin: '0 auto 18px',
            maxWidth: 560,
          }}
        >
          {QUICK_DESTINATIONS.map(opt => (
            <button
              key={opt.slug}
              onClick={() => onAnswer(opt.slug as FixedDestination)}
              style={{
                padding: isMobile ? '12px 22px' : '14px 30px',
                background: 'transparent',
                border: `.5px solid ${INK}`,
                color: INK,
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: isMobile ? 14 : 15,
                letterSpacing: '.06em',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all .25s',
                minWidth: isMobile ? 100 : 130,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = RED
                e.currentTarget.style.color = '#f5e7d2'
                e.currentTarget.style.borderColor = RED
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = INK
                e.currentTarget.style.borderColor = INK
              }}
            >
              {opt.displayName}
            </button>
          ))}
        </div>

        {/* Popular 27 駅 — 展開可能 */}
        {!showMore ? (
          <button
            onClick={() => setShowMore(true)}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.06em',
              color: DIM,
              cursor: 'pointer',
              padding: 4,
              transition: 'color .25s',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = INK }}
            onMouseLeave={e => { e.currentTarget.style.color = DIM }}
          >
            他の人気通勤先 27 駅 ▼
          </button>
        ) : (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: isMobile ? 6 : 8,
              justifyContent: 'center',
              maxWidth: '100%',
            }}
          >
            {POPULAR_DESTINATIONS.map(opt => (
              <button
                key={opt.slug}
                onClick={() => onAnswer(opt.slug as FixedDestination)}
                style={{
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  background: 'rgba(255,255,255,.4)',
                  border: '.5px solid rgba(28,24,18,.25)',
                  color: INK,
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
                  e.currentTarget.style.background = RED
                  e.currentTarget.style.color = '#f5e7d2'
                  e.currentTarget.style.borderColor = RED
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.4)'
                  e.currentTarget.style.color = INK
                  e.currentTarget.style.borderColor = 'rgba(28,24,18,.25)'
                }}
              >
                {opt.displayName}
              </button>
            ))}
          </div>
        )}

        {/* hint + 退出口 — 30 駅に通勤先がない user の救済路 (#5)
            右上の × も同等動作だが、明示的な戻り CTA で死路 UX を防止する。
            「順次追加」の一文で「いつか自分の駅も対応される」期待を残す。 */}
        <div style={{ marginTop: 28 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 11,
              color: DIM,
              letterSpacing: '.02em',
            }}
          >
            AI 推薦は現在この 30 駅を起点に対応しています。
          </p>
          <button
            onClick={onExit}
            style={{
              marginTop: 16,
              background: 'transparent',
              border: 'none',
              padding: '6px 4px',
              cursor: 'pointer',
              color: INK,
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 500,
              letterSpacing: '.06em',
              transition: 'color .2s',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = RED }}
            onMouseLeave={e => { e.currentTarget.style.color = INK }}
          >
            ← ご希望の駅が見つからない方は、地図へ戻る
          </button>
          <p
            style={{
              margin: '6px 0 0 0',
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 10.5,
              color: DIM,
              letterSpacing: '.02em',
            }}
          >
            対応駅は順次追加してまいります。
          </p>
        </div>
      </div>
    </div>
  )
}

// ── 質問ビュー（一問一屏） ────────────────────────────────────────
function QuestionView({
  q,
  index,
  total,
  destinationLabel,
  isMobile,
  onAnswer,
  onBack,
}: {
  q:                QuestionDef
  index:            number
  total:            number
  destinationLabel: string
  isMobile:         boolean
  onAnswer:         (value: AnswerValue) => void
  onBack:           (() => void) | null
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '90px 5vw 60px' : '8vh 6vw',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : 640,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* progress smallcaps */}
        <div
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '.4em', textTransform: 'uppercase',
            color: DIM,
            marginBottom: isMobile ? 14 : 18,
          }}
        >
          Question {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          {' · '}
          {destinationLabel} へ
        </div>

        {/* italic prelude */}
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 'clamp(18px, 5.4vw, 24px)' : 'clamp(24px, 2.6vw, 34px)',
            color: RED,
            margin: 0,
            letterSpacing: '-.01em',
            lineHeight: 1.15,
          }}
        >
          {q.prelude}
        </p>

        {/* 主題 — 明朝大字 */}
        <h1
          style={{
            margin: isMobile ? '18px 0 32px' : '24px 0 44px',
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 'clamp(22px, 6.2vw, 30px)' : 'clamp(28px, 3.2vw, 40px)',
            lineHeight: 1.3,
            letterSpacing: '.06em',
            color: INK,
          }}
        >
          {q.title}
        </h1>

        {/* options — flex wrap */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: isMobile ? 10 : 14,
            margin: '0 auto',
            maxWidth: 560,
          }}
        >
          {q.options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(opt.value)}
              style={{
                padding: isMobile ? '12px 18px' : '14px 26px',
                background: 'transparent',
                border: `.5px solid ${INK}`,
                color: INK,
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: isMobile ? 14 : 15,
                letterSpacing: '.06em',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all .25s',
                minWidth: isMobile ? 124 : 144,
              } as CSSProperties}
              onMouseEnter={e => {
                e.currentTarget.style.background = RED
                e.currentTarget.style.color = '#f5e7d2'
                e.currentTarget.style.borderColor = RED
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = INK
                e.currentTarget.style.borderColor = INK
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 「{destination} へ通勤」の小さな context */}
        {destinationLabel && (
          <p
            style={{
              marginTop: isMobile ? 24 : 30,
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 11,
              color: DIM,
              letterSpacing: '.04em',
            }}
          >
            {destinationLabel} への通勤を前提に
          </p>
        )}

        {/* back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              marginTop: isMobile ? 36 : 48,
              background: 'transparent', border: 'none',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.08em',
              color: DIM,
              cursor: 'pointer',
              padding: 4,
              transition: 'color .25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = INK }}
            onMouseLeave={e => { e.currentTarget.style.color = DIM }}
          >
            ← 一つ戻る
          </button>
        )}
      </div>
    </div>
  )
}

// ── ローディングビュー ───────────────────────────────────────────
function LoadingView({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '60px 5vw' : '8vh 6vw',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* compass-like spinner */}
        <div
          style={{
            display: 'inline-block',
            width: 56, height: 56,
            border: `1px solid ${INK}33`,
            borderTopColor: RED,
            borderRadius: '50%',
            animation: 'tcmWizardSpin 1.2s linear infinite',
          }}
        />
        {/* keyframes 注入 — Tailwind 設定に触らず inline で */}
        <style>{`@keyframes tcmWizardSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

        <p
          style={{
            marginTop: 32,
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 22 : 28,
            color: RED,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          searching for your places…
        </p>
        <p
          style={{
            marginTop: 14,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: isMobile ? 14 : 15,
            color: INK,
            letterSpacing: '.06em',
            lineHeight: 1.8,
          }}
        >
          1,843 駅の中から、<br />あなたに合う 20 駅を選んでいます。
        </p>
        <p
          style={{
            marginTop: 18,
            fontFamily: 'var(--display-italic, Garamond, serif)',
            fontStyle: 'italic',
            fontSize: 11,
            color: DIM,
          }}
        >
          通常 5 〜 10 秒かかります
        </p>
      </div>
    </div>
  )
}

// ── 結果ビュー（AiResultGrid wrap） ───────────────────────────────
function ResultView({
  recs,
  destinationLabel,
  isFallback,
  isCached,
  onStationClick,
  onCtaClick,
}: {
  recs:             Recommendation[]
  destinationLabel: string
  isFallback?:      boolean
  isCached?:        boolean
  onStationClick:   (name: string) => void
  onCtaClick:       () => void
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        padding: '60px 4vw 60px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <AiResultGrid
        recs={recs}
        destinationLabel={destinationLabel}
        isFallback={isFallback}
        isCached={isCached}
        onStationClick={onStationClick}
        onCtaClick={onCtaClick}
      />
    </div>
  )
}

// ── エラービュー ──────────────────────────────────────────────────
function ErrorView({
  message,
  canRetry,
  onRetry,
  onClose,
  isMobile,
}: {
  message:  string
  canRetry: boolean
  onRetry:  () => void
  onClose:  () => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '60px 5vw' : '8vh 6vw',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 22 : 28,
            color: RED,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          a small detour…
        </p>
        <h2
          style={{
            marginTop: 14,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 22 : 26,
            color: INK,
            letterSpacing: '.06em',
          }}
        >
          推薦を取得できませんでした
        </h2>
        <p
          style={{
            marginTop: 18,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: 14,
            color: '#3a312a',
            lineHeight: 1.8,
            letterSpacing: '.02em',
          }}
        >
          {message}
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {canRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '12px 26px',
                background: INK,
                color: '#f5e7d2',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '.08em',
                borderRadius: 0,
              }}
            >
              もう一度試す
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '12px 26px',
              background: 'transparent',
              color: INK,
              border: `.5px solid ${INK}`,
              cursor: 'pointer',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '.08em',
              borderRadius: 0,
            }}
          >
            地図に戻る
          </button>
        </div>
      </div>
    </div>
  )
}
