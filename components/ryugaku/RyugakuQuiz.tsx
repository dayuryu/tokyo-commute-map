'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QUESTIONS, BONUS_QUESTIONS, TOTAL_QUESTIONS } from '@/lib/ryugaku/quiz-data'
import { computeResult, decodeAnswers } from '@/lib/ryugaku/scoring'
import type { Answers } from '@/lib/ryugaku/scoring'
import type { Likert } from '@/lib/ryugaku/types'
import { C, SERIF, SANS } from './theme'
import QuizResult from './QuizResult'

// 24 题展示顺序：每 5 道主轴题后穿插 1 道彩蛋题（用户无感）
const SEQUENCE: { id: string; text: string }[] = [
  ...QUESTIONS.slice(0, 5),
  BONUS_QUESTIONS[0],
  ...QUESTIONS.slice(5, 10),
  BONUS_QUESTIONS[1],
  ...QUESTIONS.slice(10, 15),
  BONUS_QUESTIONS[2],
  ...QUESTIONS.slice(15, 20),
  BONUS_QUESTIONS[3],
].map(q => ({ id: q.id, text: q.text }))

const SCALE: { v: Likert; label: string }[] = [
  { v: 2, label: '非常同意' },
  { v: 1, label: '有点同意' },
  { v: 0, label: '看情况' },
  { v: -1, label: '不太同意' },
  { v: -2, label: '完全不是' },
]

type Phase = 'intro' | 'quiz' | 'result'

export default function RyugakuQuiz() {
  const sp = useSearchParams()
  const [phase, setPhase] = useState<Phase>('intro')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [isShared, setIsShared] = useState(false)

  // 分享链接 (?a=) 打开：还原并直接显示分享者的结果
  useEffect(() => {
    const a = sp.get('a')
    if (!a) return
    const dec = decodeAnswers(a)
    if (!dec) return
    // 一次性从分享 URL (?a=) 还原结果（client-only，规避 hydration mismatch）
    /* eslint-disable react-hooks/set-state-in-effect */
    setAnswers(dec)
    setIsShared(true)
    setPhase('result')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sp])

  const result = useMemo(
    () => (phase === 'result' ? computeResult(answers) : null),
    [phase, answers]
  )

  function choose(v: Likert) {
    const id = SEQUENCE[step].id
    const next = { ...answers, [id]: v }
    setAnswers(next)
    if (step + 1 < SEQUENCE.length) {
      setStep(step + 1)
    } else {
      setPhase('result')
    }
  }

  function restart() {
    setAnswers({})
    setStep(0)
    setIsShared(false)
    setPhase('intro')
    // 清掉分享 query，避免再次刷新又进分享结果
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const shell: React.CSSProperties = {
    // 主站 body 是 overflow-hidden h-[100dvh]（为全屏地图），故本页让 main 自身内部滚动
    height: '100dvh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: C.cream,
    color: C.ink,
    fontFamily: SANS,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding:
      'max(env(safe-area-inset-top), 24px) 22px max(env(safe-area-inset-bottom), 28px)',
    textAlign: 'center',
  }

  if (phase === 'result' && result) {
    return (
      <main lang="zh" style={{ ...shell, justifyContent: 'flex-start', paddingTop: 'max(env(safe-area-inset-top), 40px)' }}>
        <QuizResult result={result} answers={answers} isShared={isShared} onRestart={restart} />
      </main>
    )
  }

  if (phase === 'intro') {
    return (
      <main lang="zh" style={shell}>
        <Seal />
        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 7vw, 38px)', fontWeight: 600, lineHeight: 1.3, margin: '22px 0 0' }}>
          东京留学
          <br />
          居住人格测试
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.8, maxWidth: 320, margin: '16px 0 0' }}>
          24 道题，3 分钟。
          <br />
          测出你是东京 16 种留学居住人格的哪一种——
          <br />
          以及，你的本命车站。
        </p>
        <button onClick={() => setPhase('quiz')} style={primaryBtn}>
          开始测试
        </button>
        <p style={{ color: C.inkSoft, opacity: 0.7, fontSize: 12, marginTop: 18 }}>
          基于真实通勤数据 · 由 Kayoha 制作
        </p>
      </main>
    )
  }

  // quiz
  const q = SEQUENCE[step]
  const progress = (step / TOTAL_QUESTIONS) * 100

  return (
    <main lang="zh" style={shell}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* 进度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(28px, 8vh, 56px)' }}>
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} aria-label="上一题" style={backBtn}>
              ←
            </button>
          ) : (
            <span style={{ width: 28 }} />
          )}
          <div style={{ flex: 1, height: 4, background: C.line, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: C.red, transition: 'width .3s ease' }} />
          </div>
          <span style={{ fontSize: 12, color: C.inkSoft, minWidth: 38, textAlign: 'right' }}>
            {step + 1}/{TOTAL_QUESTIONS}
          </span>
        </div>

        {/* 题目 */}
        <p style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 5.4vw, 26px)', fontWeight: 500, lineHeight: 1.55, minHeight: '3.2em', margin: '0 0 clamp(24px, 6vh, 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {q.text}
        </p>

        {/* 5 级量表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SCALE.map(opt => {
            const active = answers[q.id] === opt.v
            return (
              <button
                key={opt.v}
                onClick={() => choose(opt.v)}
                style={{
                  ...scaleBtn,
                  background: active ? C.red : 'rgba(255,255,255,0.6)',
                  color: active ? C.paper : C.ink,
                  borderColor: active ? C.red : C.line,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function Seal() {
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: 6,
        background: C.red,
        color: C.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SERIF,
        fontSize: 44,
        fontWeight: 700,
        boxShadow: '0 6px 18px rgba(122,28,20,0.22)',
      }}
    >
      留
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  marginTop: 30,
  font: 'inherit',
  fontSize: 16,
  fontWeight: 600,
  color: C.paper,
  background: C.red,
  border: 'none',
  borderRadius: 999,
  padding: '14px 46px',
  cursor: 'pointer',
  boxShadow: '0 2px 12px rgba(168,51,43,0.28)',
}

const scaleBtn: React.CSSProperties = {
  font: 'inherit',
  fontSize: 16,
  padding: '15px 18px',
  borderRadius: 14,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all .15s ease',
  WebkitTapHighlightColor: 'transparent',
}

const backBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  color: C.inkSoft,
  fontSize: 20,
  cursor: 'pointer',
  lineHeight: 1,
}
