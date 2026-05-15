'use client'

/**
 * 地図左下の AI Advisor フロートボタン。
 *
 * hasCache (= isAiCacheFresh) に応じて 2 つの mode を持つ：
 *   - hasCache=false (初回発見):「AI に聞いてみる」CTA、押下で新規 wizard 起動
 *   - hasCache=true  (再表示):  「20 駅を再表示」CTA、押下で wizard を result phase 直起動
 *
 * これにより、DestinationAsk で AI を選ばずに地図に来た user も
 * 後から「やっぱり AI に聞こう」と思った時に地図上から起動できる (#6)。
 *
 * Legend (右下) と HeaderMenu (右上) を避け、左下に配置。
 * 「左下 AI · 右下 Legend」で視覚的に対称、両者の上に積み重ならない設計。
 *
 * ── attention sequence
 * mount 時、sessionStorage に hinted フラグが無ければ：
 *   - 500ms 後に tooltip フェードイン + ボタン pulse 開始
 *   - 3.5s 表示後フェードアウト + pulse 停止
 *   - sessionStorage に hinted=1 を記録（同セッション内は再 trigger しない）
 * 新セッション（ブラウザタブを開き直す）では再度 hint が出る — 温和な教育設計。
 */

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

const INK = '#1c1812'
const RED = '#a8332b'

const HINT_SESSION_KEY = 'tcm_ai_recall_hinted_v1'
const HINT_DELAY_MS    = 500
const HINT_DURATION_MS = 3500

interface Props {
  /** aiCache が 24h 以内に存在するか — true なら「再表示」mode、false なら「初回」mode */
  hasCache: boolean
  /** 押下時に呼ばれる。親側で hasCache に応じて handleRecallWizard / handleStartWizard を切替 */
  onClick:  () => void
}

export default function AiRecallButton({ hasCache, onClick }: Props) {
  const isMobile = useIsMobile()
  const [showHint, setShowHint] = useState(false)

  // mount 時の attention sequence — session 内 1 回限り
  useEffect(() => {
    let alreadyHinted = true
    try {
      alreadyHinted = sessionStorage.getItem(HINT_SESSION_KEY) === '1'
    } catch {}
    if (alreadyHinted) return

    const fadeInTimer = window.setTimeout(() => setShowHint(true), HINT_DELAY_MS)
    const fadeOutTimer = window.setTimeout(
      () => setShowHint(false),
      HINT_DELAY_MS + HINT_DURATION_MS,
    )
    try { sessionStorage.setItem(HINT_SESSION_KEY, '1') } catch {}

    return () => {
      window.clearTimeout(fadeInTimer)
      window.clearTimeout(fadeOutTimer)
    }
  }, [])

  return (
    <>
      {/* keyframes 注入 — Tailwind 設定に触らず inline で完結 */}
      <style>{`
        @keyframes tcmRecallPulse {
          0%, 100% {
            box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(168,51,43,.10);
          }
          50% {
            box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(168,51,43,.45);
          }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          zIndex: 11,
          left: isMobile
            ? 'max(12px, env(safe-area-inset-left))'
            : 'max(20px, env(safe-area-inset-left, 0px))',
          // bottom は Legend (右下) と揃える: MapLibre attribution 帯 (~24-28px)
          // を避けるため +32px。両者 bottom 値同一 → 下端 viewport 距離が一致 →
          // 下辺水平 alignment 成立。
          bottom: isMobile
            ? 'calc(max(12px, env(safe-area-inset-bottom)) + 32px)'
            : 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 32px)',
        }}
      >
        {/* tooltip — button 上方にフロート、pointer-events: none で操作の邪魔をしない */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: 'calc(100% + 10px)',
            minWidth: isMobile ? 200 : 240,
            padding: isMobile ? '10px 14px' : '12px 16px',
            background: INK,
            color: '#f5e7d2',
            borderRadius: 0,
            border: `.5px solid ${INK}`,
            boxShadow: '0 1px 2px rgba(0,0,0,.06), 0 10px 28px rgba(28,24,18,.30)',
            opacity: showHint ? 1 : 0,
            transform: showHint ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity .45s cubic-bezier(.2,.8,.2,1), transform .45s cubic-bezier(.2,.8,.2,1)',
            pointerEvents: 'none',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
              fontSize: 9,
              letterSpacing: '.3em',
              textTransform: 'uppercase',
              opacity: .7,
              marginBottom: 4,
            }}
          >
            ✦ AI Advisor
          </div>
          <div
            style={{
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.04em',
            }}
          >
            {hasCache
              ? <>ここから 20 駅推薦を<br />いつでも再表示できます</>
              : <>6 つの質問で、<br />あなたに合う 20 駅を提案</>}
          </div>
          {/* 三角形矢印 — button 方向を指す */}
          <div
            style={{
              position: 'absolute',
              left: 24,
              bottom: -6,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${INK}`,
            }}
          />
        </div>

        {/* button 本体 */}
        <button
          onClick={onClick}
          aria-label={hasCache ? 'AI 推薦を再表示' : 'AI に駅を提案してもらう'}
          style={{
            padding: isMobile ? '8px 14px' : '10px 18px',
            background: 'rgba(244, 241, 234, 0.92)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: `.5px solid ${RED}`,
            color: INK,
            cursor: 'pointer',
            borderRadius: 0,
            boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(168,51,43,.10)',
            transition: 'all .25s',
            textAlign: 'left',
            lineHeight: 1.2,
            // hint 中は pulse animation を 2 回循環（合計 ~3.6s）
            animation: showHint ? 'tcmRecallPulse 1.8s ease-in-out 0s 2' : 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = RED
            e.currentTarget.style.color = '#f5e7d2'
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,.06), 0 10px 28px rgba(168,51,43,.22)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(244, 241, 234, 0.92)'
            e.currentTarget.style.color = INK
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(168,51,43,.10)'
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
              fontSize: isMobile ? 8 : 9,
              letterSpacing: '.3em',
              textTransform: 'uppercase',
              opacity: .8,
            }}
          >
            ✦ AI Advisor
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontWeight: 600,
              fontSize: isMobile ? 11 : 12.5,
              letterSpacing: '.06em',
            }}
          >
            {hasCache ? '20 駅を再表示 →' : 'AI に聞いてみる →'}
          </div>
        </button>
      </div>
    </>
  )
}
