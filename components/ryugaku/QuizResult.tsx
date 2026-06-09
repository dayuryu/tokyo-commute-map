'use client'

import { useState } from 'react'
import { AXES, AXIS_ORDER } from '@/lib/ryugaku/quiz-data'
import { encodeAnswers, resultFace, resultStations } from '@/lib/ryugaku/scoring'
import type { Answers } from '@/lib/ryugaku/scoring'
import type { QuizResult as Result } from '@/lib/ryugaku/types'
import { C, SERIF, SANS } from './theme'

// 确定性"占比"（演示值，后续接真实统计）
function pct(code: string, isHidden: boolean): string {
  let h = 0
  for (const ch of code + (isHidden ? '*' : '')) h = (h * 31 + ch.charCodeAt(0)) % 100000
  return isHidden ? (0.6 + (h % 240) / 100).toFixed(1) : (4 + (h % 120) / 10).toFixed(1)
}

export default function QuizResult({
  result,
  answers,
  isShared,
  onRestart,
}: {
  result: Result
  answers: Answers
  isShared: boolean
  onRestart: () => void
}) {
  const face = resultFace(result)
  const stations = resultStations(result)
  const [copied, setCopied] = useState(false)

  async function share() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?a=${encodeAnswers(answers)}`
        : ''
    const text = `我是「${face.name}」(${face.code}) — 东京留学居住人格测试`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '东京留学居住人格测试', text, url })
        return
      } catch {
        /* 用户取消，落到复制 */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      /* ignore */
    }
  }

  const mapHref = `/?rstations=${encodeURIComponent(stations.join(','))}`

  return (
    <div style={{ width: '100%', maxWidth: 460, margin: '0 auto' }}>
      {face.isHidden && (
        <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, letterSpacing: '.08em', color: C.red, border: `1px solid ${C.red}`, borderRadius: 999, padding: '4px 14px', marginBottom: 16 }}>
          稀有人格 · 全网约 {pct(face.code, true)}%
        </div>
      )}

      {/* 4 字母代号 */}
      <div style={{ fontFamily: SERIF, fontSize: 'clamp(40px, 12vw, 60px)', fontWeight: 700, letterSpacing: '.14em', color: C.red, lineHeight: 1 }}>
        {face.code}
      </div>

      {/* 型名 */}
      <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 7vw, 36px)', fontWeight: 600, margin: '12px 0 0', lineHeight: 1.3 }}>
        {face.name}
      </h1>

      {!face.isHidden && (
        <p style={{ fontSize: 12, color: C.inkSoft, opacity: 0.75, margin: '8px 0 0' }}>
          全网约 {pct(face.code, false)}% 和你一样
        </p>
      )}

      {/* slogan */}
      <p style={{ fontSize: 16, lineHeight: 1.85, color: C.ink, margin: '20px auto 0', maxWidth: 380, padding: '0 4px' }}>
        “{face.slogan}”
      </p>

      {/* 四维 */}
      <div style={{ margin: '30px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {AXIS_ORDER.map(key => {
          const axis = AXES.find(a => a.key === key)!
          const v = result.axes[key] // -1..1
          const posPct = ((v + 1) / 2) * 100
          const towardPos = v >= 0
          return (
            <div key={key} style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: towardPos ? C.ink : C.inkSoft, fontWeight: towardPos ? 600 : 400 }}>
                  {axis.pos.label}
                </span>
                <span style={{ color: C.inkSoft, opacity: 0.6 }}>{axis.emoji}</span>
                <span style={{ color: !towardPos ? C.ink : C.inkSoft, fontWeight: !towardPos ? 600 : 400 }}>
                  {axis.neg.label}
                </span>
              </div>
              <div style={{ position: 'relative', height: 6, background: C.line, borderRadius: 99 }}>
                <div style={{ position: 'absolute', left: `calc(${posPct}% - 6px)`, top: -3, width: 12, height: 12, borderRadius: 99, background: C.red, boxShadow: '0 1px 4px rgba(168,51,43,.3)' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 本命车站 */}
      <div style={{ margin: '32px 0 0' }}>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12, letterSpacing: '.04em' }}>你的本命车站</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {stations.map(s => (
            <span key={s} style={{ fontFamily: SERIF, fontSize: 15, padding: '7px 16px', background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.line}`, borderRadius: 999 }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* CTA 导流地图 */}
      <a href={mapHref} style={{ display: 'block', marginTop: 28, textDecoration: 'none', font: SANS, fontSize: 16, fontWeight: 600, color: C.paper, background: C.red, borderRadius: 999, padding: '15px 24px', boxShadow: '0 2px 12px rgba(168,51,43,0.28)' }}>
        在地图上看你的专属车站 →
      </a>

      {/* 分享 + 重测 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={share} style={secondaryBtn}>
          {copied ? '链接已复制 ✓' : '分享我的结果'}
        </button>
        <button onClick={onRestart} style={secondaryBtn}>
          {isShared ? '我也来测' : '重新测'}
        </button>
      </div>

      <p style={{ color: C.inkSoft, opacity: 0.6, fontSize: 11, marginTop: 22, lineHeight: 1.7 }}>
        娱乐测试 · 占比为演示值 · 由 Kayoha 制作
      </p>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  font: 'inherit',
  fontFamily: SANS,
  fontSize: 14.5,
  fontWeight: 500,
  color: C.ink,
  background: 'rgba(255,255,255,0.7)',
  border: `1px solid ${C.line}`,
  borderRadius: 999,
  padding: '13px 12px',
  cursor: 'pointer',
}
