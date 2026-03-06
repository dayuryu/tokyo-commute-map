// components/DestinationPicker.tsx
'use client'
import type { Destination } from '@/app/page'

const OPTIONS: { value: Destination; label: string }[] = [
  { value: 'shinjuku', label: '新宿' },
  { value: 'shibuya',  label: '渋谷' },
  { value: 'tokyo',    label: '東京駅' },
]

interface Props {
  value: Destination
  onChange: (v: Destination) => void
}

export default function DestinationPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-xl text-sm font-medium transition-all
            ${value === opt.value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
