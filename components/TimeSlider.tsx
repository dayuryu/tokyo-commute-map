// components/TimeSlider.tsx
'use client'

interface Props {
  value: number
  onChange: (v: number) => void
}

export default function TimeSlider({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span
        className="smallcaps whitespace-nowrap"
        style={{ color: 'var(--ink-mute)', fontSize: 10.5 }}
      >
        通勤上限
      </span>
      <input
        type="range"
        min={15} max={90} step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pretty flex-1 min-w-0"
      />
      <span
        className="font-mono-num tabular-nums whitespace-nowrap w-14 text-right"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '.02em',
        }}
      >
        {value} 分
      </span>
    </div>
  )
}
