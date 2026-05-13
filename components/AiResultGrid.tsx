'use client'

/**
 * AI 推薦結果のグリッド表示。
 *
 * 主人が preview/recommendations/layouts/Grid.tsx で選定した案 A を本格化。
 * Wizard の最終 step（result）から呼ばれる想定で、各カードクリック
 * → 該当駅を地図上で開く / CTA → 結果画面を閉じて地図に戻る。
 *
 * カード hover は主題赤を subtle に重ねた warm な editorial 風で、
 * 「20 駅を眺めて選ぶ」体験を引き締める。
 */

import type { Recommendation } from '@/lib/ai-recommend/types'

const INK = '#1c1812'
const DIM = '#7d7060'
const RED = '#a8332b'

interface Props {
  recs:              Recommendation[]
  /** 通勤先の表示名（「新宿」「渋谷」など）— ヘッダーの sub text に表示 */
  destinationLabel?: string
  /** カード（駅名）クリック時の callback。Map を開いて該当駅 drawer を表示する用 */
  onStationClick:   (stationName: string) => void
  /** CTA「地図で見比べる」クリック時の callback。Wizard 全体を閉じる用 */
  onCtaClick:       () => void
  /** Fallback / cached 表示用（任意）— OpenAI を呼ばずに返した場合 true */
  isFallback?:      boolean
  isCached?:        boolean
}

export default function AiResultGrid({
  recs,
  destinationLabel,
  onStationClick,
  onCtaClick,
  isFallback,
  isCached,
}: Props) {
  return (
    <div>
      <Header destinationLabel={destinationLabel} isFallback={isFallback} isCached={isCached} />

      <div
        style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 14,
        }}
      >
        {recs.map((r, i) => (
          <Card
            key={`${r.station_name}-${i}`}
            rec={r}
            rank={i + 1}
            onClick={() => onStationClick(r.station_name)}
          />
        ))}
      </div>

      <CtaBlock onCtaClick={onCtaClick} />
    </div>
  )
}

function Header({
  destinationLabel,
  isFallback,
  isCached,
}: {
  destinationLabel?: string
  isFallback?:       boolean
  isCached?:         boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--mono, monospace)',
          fontSize: 10,
          letterSpacing: '.4em',
          textTransform: 'uppercase',
          color: DIM,
        }}
      >
        Recommendations · 20 stations
      </div>
      <p
        style={{
          marginTop: 10,
          fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
          fontStyle: 'italic',
          fontSize: 'clamp(22px, 2.4vw, 32px)',
          color: RED,
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        twenty places for you.
      </p>
      <h1
        style={{
          marginTop: 12,
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontWeight: 600,
          fontSize: 'clamp(24px, 3.2vw, 36px)',
          letterSpacing: '.06em',
          color: INK,
          margin: '12px 0 0 0',
        }}
      >
        あなたへの 20 の街
      </h1>
      {destinationLabel && (
        <p
          style={{
            marginTop: 8,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: 13,
            letterSpacing: '.08em',
            color: DIM,
          }}
        >
          {destinationLabel} への通勤を起点に
        </p>
      )}
      {(isFallback || isCached) && (
        <p
          style={{
            marginTop: 6,
            fontFamily: 'var(--display-italic, Garamond, serif)',
            fontStyle: 'italic',
            fontSize: 11,
            color: DIM,
            letterSpacing: '.02em',
          }}
        >
          {isFallback
            ? '※ AI 接続を簡略化した代替推薦を表示しています'
            : '※ 同じ条件の過去推薦を再利用しています'}
        </p>
      )}
    </div>
  )
}

function Card({
  rec,
  rank,
  onClick,
}: {
  rec:     Recommendation
  rank:    number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '18px 18px 16px',
        background: 'rgba(255,255,255,.55)',
        border: `.5px solid ${INK}26`,
        borderRadius: 0,
        cursor: 'pointer',
        transition: 'all .2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 132,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,250,243,.92)'
        e.currentTarget.style.borderColor = 'rgba(168,51,43,.55)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(168,51,43,.14), 0 2px 6px rgba(28,24,18,.06)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,.55)'
        e.currentTarget.style.borderColor = `${INK}26`
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* rank chip — Garamond italic */}
      <div
        style={{
          fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
          fontStyle: 'italic',
          fontSize: 22,
          color: RED,
          lineHeight: 1,
          opacity: .9,
        }}
      >
        {String(rank).padStart(2, '0')}
      </div>

      {/* station name */}
      <div
        style={{
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: '.04em',
          color: INK,
          lineHeight: 1.25,
        }}
      >
        {rec.station_name}
      </div>

      {/* reason */}
      <div
        style={{
          marginTop: 2,
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontSize: 13,
          lineHeight: 1.75,
          letterSpacing: '.02em',
          color: '#3a312a',
        }}
      >
        {rec.reason}
      </div>
    </button>
  )
}

function CtaBlock({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <div style={{ marginTop: 40, textAlign: 'center' }}>
      <button
        onClick={onCtaClick}
        style={{
          padding: '14px 32px',
          background: INK,
          color: '#f5e7d2',
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: '.08em',
          transition: 'opacity .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        地図で見比べる →
      </button>
      <p
        style={{
          marginTop: 14,
          fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
          fontStyle: 'italic',
          fontSize: 11,
          color: DIM,
          letterSpacing: '.02em',
        }}
      >
        AI による参考情報。最終的な判断はご自身でお願いします。
      </p>
    </div>
  )
}
