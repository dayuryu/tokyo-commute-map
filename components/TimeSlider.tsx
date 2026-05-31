// components/TimeSlider.tsx
'use client'
import { useAtom } from 'jotai'
import { useTranslations } from 'next-intl'
import { maxMinutesAtom } from '@/lib/atoms/ui'

export default function TimeSlider() {
  const t = useTranslations('timeSlider')
  const [value, setValue] = useAtom(maxMinutesAtom)
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span
        className="smallcaps whitespace-nowrap"
        style={{ color: 'var(--ink-mute)', fontSize: 10.5 }}
      >
        {t('label')}
      </span>
      <input
        type="range"
        min={15} max={90} step={5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
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
        {value} {t('valueSuffix')}
      </span>
    </div>
  )
}
