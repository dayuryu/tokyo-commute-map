// components/TimeSlider.tsx
'use client'

interface Props {
  value: number
  onChange: (v: number) => void
}

export default function TimeSlider({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 whitespace-nowrap">通勤</span>
      <input
        type="range" min={15} max={90} step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-36 accent-blue-500"
      />
      <span className="text-sm font-bold text-blue-600 w-16">
        {value}分以内
      </span>
    </div>
  )
}
