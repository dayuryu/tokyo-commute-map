'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/device-id'
import type { Destination } from '@/app/page'

interface Props {
  stationCode:  number
  stationName:  string
  destination:  Destination       // 'custom' も受け取る
  destLabel:    string             // 表示用ラベル（custom の場合は実駅名）
  algorithmMin: number              // 表示中の算出値
}

// デバイス ID は lib/device-id.ts に集約（非 Secure Context でも安全な fallback 付き）

function getTolerance(algorithm: number): number {
  return Math.max(Math.round(algorithm * 0.4), 30)
}

function isInRange(reported: number, algorithm: number): boolean {
  if (!Number.isInteger(reported)) return false
  if (reported < 5 || reported > 180) return false
  return Math.abs(reported - algorithm) <= getTolerance(algorithm)
}

// 共通 link 風スタイル
const linkBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
  fontSize: 12,
  letterSpacing: '.04em',
  color: 'var(--ink-mute)',
  cursor: 'pointer',
  transition: 'color .2s',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}

export default function CorrectionReporter({
  stationCode, stationName, destination, destLabel, algorithmMin,
}: Props) {
  const [open,       setOpen]       = useState(false)
  const [value,      setValue]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const isCustom = destination === 'custom'
  const reported = Number(value)
  const isNum    = value !== '' && !isNaN(reported)
  const valid    = !isCustom && isNum && isInRange(reported, algorithmMin)

  async function handleSubmit() {
    if (!valid || isCustom) return
    setSubmitting(true)
    setError(null)

    const { error: dbError } = await supabase
      .from('station_time_corrections')
      .upsert({
        station_code:  stationCode,
        station_name:  stationName,
        destination,
        reported_min:  reported,
        algorithm_min: algorithmMin,
        device_id:     getDeviceId(),
      }, { onConflict: 'station_code,destination,device_id' })

    setSubmitting(false)
    if (dbError) {
      setError('送信に失敗しました。時間をおいて再試行してください。')
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div style={{
        marginTop: 8,
        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
        fontSize: 12,
        color: '#5e7044',
        letterSpacing: '.04em',
      }}>
        ✓ 報告ありがとうございます（3人以上で反映）
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={linkBtnStyle}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-mute)' }}
      >
        {isCustom
          ? 'この時間について →'
          : 'この時間が違う？正しい値を報告 →'}
      </button>
    )
  }

  // Custom destination 時の info panel（校正 backend 未対応のため）
  if (isCustom) {
    return (
      <div style={{
        marginTop: 8,
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.45)',
        border: '.5px solid rgba(28,24,18,.15)',
        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
        fontSize: 12,
        lineHeight: 1.75,
        color: 'var(--ink-soft)',
        letterSpacing: '.04em',
      }}>
        <p style={{ margin: '0 0 6px' }}>
          カスタム目的地（<strong style={{ color: 'var(--ink)' }}>{destLabel}</strong>）への
          校正報告は今後対応予定です。
        </p>
        <p style={{ margin: 0, color: 'var(--ink-mute)', fontSize: 11 }}>
          現在は <strong>30 個の主要通勤駅</strong>（新宿・渋谷・東京駅・池袋・品川 等）への
          通勤時間をコミュニティ校正できます。
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{
            ...linkBtnStyle,
            marginTop: 10,
            fontSize: 11,
            textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-mute)' }}
        >
          ← 閉じる
        </button>
      </div>
    )
  }

  // 通常モード（default 3 destination）
  const tol = getTolerance(algorithmMin)

  return (
    <div style={{
      marginTop: 8,
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.5)',
      border: '.5px solid rgba(28,24,18,.18)',
    }}>
      <div style={{
        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
        fontSize: 12,
        color: 'var(--ink-soft)',
        letterSpacing: '.06em',
        marginBottom: 10,
      }}>
        {stationName} → {destLabel} の実際の通勤時間（分）
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          type="number" min={5} max={180} step={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="例: 35"
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.7)',
            border: '.5px solid rgba(28,24,18,.18)',
            borderRadius: 0,
            fontFamily: 'var(--mono, monospace)',
            // mobile 16px 未満は iOS Safari が focus 時に自動 zoom する。
            fontSize: 16,
            color: 'var(--ink)',
            letterSpacing: '.02em',
            outline: 'none',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--ink)' }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(28,24,18,.18)' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          style={{
            padding: '0 18px',
            background: 'var(--ink)',
            color: '#f5e7d2',
            border: '.5px solid var(--ink)',
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: '.06em',
            borderRadius: 0,
            cursor: (!valid || submitting) ? 'not-allowed' : 'pointer',
            opacity: (!valid || submitting) ? 0.4 : 1,
            transition: 'opacity .2s',
            whiteSpace: 'nowrap',
          }}
        >
          {submitting ? '…' : '報告'}
        </button>
      </div>

      {isNum && !valid && (
        <div style={{
          marginTop: 7,
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontSize: 11,
          color: 'var(--pin)',
          letterSpacing: '.04em',
        }}>
          ※ 推定値 {algorithmMin}分 から ±{tol}分 以内で入力してください
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 7,
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontSize: 11,
          color: 'var(--pin)',
          letterSpacing: '.04em',
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: 9,
        fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
        fontStyle: 'italic',
        fontSize: 10.5,
        color: 'var(--ink-mute)',
        letterSpacing: '.02em',
      }}>
        ※ 3人以上の報告で表示時間が更新されます
      </div>

      <button
        onClick={() => setOpen(false)}
        style={{
          ...linkBtnStyle,
          marginTop: 9,
          fontSize: 11,
          textDecoration: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-mute)' }}
      >
        ← 閉じる
      </button>
    </div>
  )
}
