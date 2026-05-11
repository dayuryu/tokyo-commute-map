'use client'
import { BUCKET_COLORS, getBucketThresholds, getBucketLabels } from '@/lib/buckets'

interface Props {
  maxMinutes: number
}

export default function Legend({ maxMinutes }: Props) {
  const thresholds = getBucketThresholds(maxMinutes)
  const labels = getBucketLabels(thresholds)

  return (
    <div
      className="absolute top-3 right-3 md:top-5 md:right-5 z-10
                 rounded-2xl px-4 py-3
                 border border-black/[.07]
                 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_32px_rgba(0,0,0,.10)]
                 hidden sm:block"
      style={{
        background: 'rgba(244, 241, 234, 0.78)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div className="smallcaps mb-2 text-center"
           style={{ color: 'var(--ink-mute)' }}>
        通勤時間
      </div>
      <ul className="space-y-1.5">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{
                background: BUCKET_COLORS[i],
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            />
            <span
              className="font-mono-num tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--ink-soft)',
                letterSpacing: '.04em',
              }}
            >
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
