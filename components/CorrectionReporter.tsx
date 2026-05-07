'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Destination } from '@/app/page'

type ReportDest = Exclude<Destination, 'custom'>

const DEST_LABELS: Record<ReportDest, string> = {
  shinjuku: '新宿',
  shibuya:  '渋谷',
  tokyo:    '東京駅',
}

interface Props {
  stationCode:  number
  stationName:  string
  destination:  ReportDest
  algorithmMin: number
}

function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

function getTolerance(algorithm: number): number {
  return Math.max(Math.round(algorithm * 0.4), 30)
}

function isInRange(reported: number, algorithm: number): boolean {
  if (!Number.isInteger(reported)) return false
  if (reported < 5 || reported > 180) return false
  return Math.abs(reported - algorithm) <= getTolerance(algorithm)
}

export default function CorrectionReporter({
  stationCode, stationName, destination, algorithmMin,
}: Props) {
  const [open,       setOpen]       = useState(false)
  const [value,      setValue]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const reported = Number(value)
  const isNum    = value !== '' && !isNaN(reported)
  const valid    = isNum && isInRange(reported, algorithmMin)

  async function handleSubmit() {
    if (!valid) return
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
      <div className="text-center text-xs text-green-600 mt-3 mb-2">
        ✅ 報告ありがとうございます（3人以上の報告で反映されます）
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center text-xs text-gray-500
                   hover:text-blue-600 underline mt-3 mb-2 transition-colors"
      >
        この時間が違う？正しい値を報告 ▼
      </button>
    )
  }

  const tol = getTolerance(algorithmMin)

  return (
    <div className="bg-gray-50 rounded-xl p-3 mt-3 mb-2">
      <div className="text-xs text-gray-600 mb-2">
        {stationName} → {DEST_LABELS[destination]} の実際の通勤時間（分）
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number" min={5} max={180} step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="例: 35"
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-medium px-4 py-1.5 rounded-lg disabled:opacity-40
                     transition-colors"
        >
          {submitting ? '...' : '報告'}
        </button>
      </div>
      {isNum && !valid && (
        <div className="text-xs text-red-500 mt-1.5">
          ※ 推定値 {algorithmMin}分 から ±{tol}分 以内で入力してください
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500 mt-1.5">{error}</div>
      )}
      <div className="text-xs text-gray-400 mt-2">
        ※ 3人以上の報告で表示時間が更新されます
      </div>
    </div>
  )
}
