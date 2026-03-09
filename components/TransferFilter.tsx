// components/TransferFilter.tsx
'use client'
import { useState, useRef, useEffect } from 'react'

const OPTIONS = [
  {
    value: 99,
    label: '制限なし',
    sub: 'すべての路線を表示',
    badge: null,
  },
  {
    value: 0,
    label: '直通のみ',
    sub: '乗り換えなしで到着',
    badge: '0',
  },
  {
    value: 1,
    label: '1回乗換まで',
    sub: '1回以内の乗り換えで到着',
    badge: '1',
  },
]

// 乗換アイコン（矢印2本が交差するSVG）
function TransferIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 5h9M11 5l-2-2M11 5l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11H5M4 11l2 2M4 11l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface Props {
  value: number
  onChange: (v: number) => void
}

export default function TransferFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const current = OPTIONS.find(o => o.value === value) ?? OPTIONS[0]
  const isActive = value < 99

  return (
    <div ref={ref} className="relative">

      {/* ── トリガー ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          group flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
          transition-all duration-200 whitespace-nowrap select-none
          ${isActive
            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }
        `}
      >
        <TransferIcon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
        <span className="leading-none">{isActive ? current.label : '乗換'}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/80' : 'text-gray-400'}`}
          viewBox="0 0 12 8" fill="none"
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── ドロップダウン ── */}
      <div
        className={`
          absolute right-0 top-full mt-2 z-50 w-64
          bg-white/95 backdrop-blur-md rounded-2xl
          shadow-2xl shadow-black/10 border border-white/60
          transition-all duration-200 origin-top-right
          ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
        `}
      >
        {/* ヘッダー */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5">
            <TransferIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">乗換回数</span>
          </div>
        </div>

        <div className="px-2 pb-2 space-y-0.5">
          {OPTIONS.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                  transition-all duration-150 group/item
                  ${selected
                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50'
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                {/* バッジ */}
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold
                  transition-all
                  ${selected
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-200'
                    : 'bg-gray-100 text-gray-400 group-hover/item:bg-gray-200'
                  }
                `}>
                  {opt.badge !== null ? opt.badge : (
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>

                {/* テキスト */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold leading-tight ${selected ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </div>
                  <div className={`text-xs mt-0.5 leading-tight ${selected ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {opt.sub}
                  </div>
                </div>

                {/* チェックマーク */}
                {selected && (
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
