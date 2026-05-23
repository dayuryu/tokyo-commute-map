'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/device-id'
import type { Destination } from '@/lib/types'

interface Props {
  stationCode:  number
  stationName:  string
  destination:  Destination
  destLabel:    string
  algorithmMin: number
}

function getTolerance(algorithm: number): number {
  return Math.max(Math.round(algorithm * 0.4), 30)
}

function isInRange(reported: number, algorithm: number): boolean {
  if (!Number.isInteger(reported)) return false
  if (reported < 5 || reported > 180) return false
  return Math.abs(reported - algorithm) <= getTolerance(algorithm)
}

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
  const t = useTranslations('correctionReporter')
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
      setError(t('submitError'))
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
        {t('submitted')}
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
        {isCustom ? t('triggerCustom') : t('triggerNormal')}
      </button>
    )
  }

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
          {t('customInfoBody', { destLabel })}
        </p>
        <p style={{ margin: 0, color: 'var(--ink-mute)', fontSize: 11 }}>
          {t('customInfoNote')}
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
          {t('close')}
        </button>
      </div>
    )
  }

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
        {t('inputLead', { stationName, destLabel })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          type="number" min={5} max={180} step={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t('inputPlaceholder')}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.7)',
            border: '.5px solid rgba(28,24,18,.18)',
            borderRadius: 0,
            fontFamily: 'var(--mono, monospace)',
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
          {submitting ? t('submitting') : t('submit')}
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
          {t('rangeHint', { algorithm: algorithmMin, tolerance: tol })}
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
        {t('consensusNote')}
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
        {t('close')}
      </button>
    </div>
  )
}
