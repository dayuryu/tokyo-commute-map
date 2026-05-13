'use client'
import { BUCKET_COLORS, getBucketThresholds, getBucketLabels } from '@/lib/buckets'

interface Props {
  maxMinutes: number
}

export default function Legend({ maxMinutes }: Props) {
  const thresholds = getBucketThresholds(maxMinutes)
  const labels = getBucketLabels(thresholds)

  return (
    <>
      {/* デスクトップ：右下に縦並びカード（右上は HeaderMenu に譲る） */}
      <div
        className="absolute z-10
                   rounded-2xl px-4 py-3
                   border border-black/[.07]
                   shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_32px_rgba(0,0,0,.10)]
                   hidden sm:block"
        style={{
          right: 'max(20px, env(safe-area-inset-right, 0px))',
          // bottom 余白は MapLibre attribution 帯（約 24-28px）を避けるため +32px
          bottom: 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 32px)',
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

      {/* モバイル：右下に横並びカラーバー（safe-area 考慮、コンパクト） */}
      <div
        className="absolute z-10 sm:hidden
                   rounded-xl px-3 py-2
                   border border-black/[.07]
                   shadow-[0_1px_2px_rgba(0,0,0,.04),0_4px_16px_rgba(0,0,0,.10)]"
        style={{
          right: 'max(12px, env(safe-area-inset-right))',
          // bottom 余白は MapLibre attribution 帯（約 24-28px）を避けるため +32px
          bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 32px)',
          background: 'rgba(244, 241, 234, 0.86)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontSize: 10,
            color: 'var(--ink-soft)',
            letterSpacing: '.04em',
          }}
        >
          <span style={{ minWidth: 28, textAlign: 'right' }}>近</span>
          <div className="flex items-center">
            {BUCKET_COLORS.slice(0, thresholds.length + 1).map((color, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 8,
                  background: color,
                  borderTop: '.5px solid rgba(255,255,255,0.5)',
                  borderBottom: '.5px solid rgba(255,255,255,0.5)',
                  borderLeft: i === 0 ? '.5px solid rgba(255,255,255,0.5)' : 'none',
                  borderRight: i === thresholds.length ? '.5px solid rgba(255,255,255,0.5)' : 'none',
                  borderRadius: i === 0 ? '4px 0 0 4px'
                    : i === thresholds.length ? '0 4px 4px 0' : 0,
                }}
              />
            ))}
          </div>
          <span style={{ minWidth: 28 }}>遠</span>
        </div>
        <div
          className="font-mono-num tabular-nums mt-1 text-center"
          style={{
            fontSize: 9,
            color: 'var(--ink-mute)',
            letterSpacing: '.06em',
          }}
        >
          0 — {maxMinutes}分
        </div>
      </div>
    </>
  )
}
