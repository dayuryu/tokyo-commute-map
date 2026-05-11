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
          group flex items-center gap-2 px-3 py-1.5 rounded text-sm
          transition-all duration-200 whitespace-nowrap select-none
          ${isActive ? 'shadow-sm' : 'hover:bg-black/5'}
        `}
        style={{
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontWeight: isActive ? 600 : 500,
          letterSpacing: '.04em',
          background: isActive ? 'var(--ink)' : 'transparent',
          color: isActive ? '#f5e7d2' : 'var(--ink-soft)',
        }}
      >
        <TransferIcon className="w-3.5 h-3.5 transition-colors"
                       />
        <span className="leading-none">{isActive ? current.label : '乗換'}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 8" fill="none"
          style={{ opacity: isActive ? 0.8 : 0.5 }}
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── ドロップダウン ── */}
      <div
        className={`
          absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl
          transition-all duration-200 origin-top-right
          ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
        `}
        style={{
          background: 'rgba(244, 241, 234, 0.95)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '.5px solid rgba(28,24,18,.10)',
          boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.16)',
        }}
      >
        {/* ヘッダー */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
            <TransferIcon className="w-3.5 h-3.5" />
            <span className="smallcaps" style={{ color: 'var(--ink-mute)' }}>乗換回数</span>
          </div>
        </div>

        <div className="px-2 pb-2 space-y-0.5">
          {OPTIONS.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group/item hover:bg-black/[.04]"
                style={{
                  background: selected ? 'rgba(28,24,18,.06)' : 'transparent',
                }}
              >
                {/* バッジ */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all"
                  style={{
                    background: selected ? 'var(--ink)' : 'rgba(28,24,18,.08)',
                    color: selected ? '#f5e7d2' : 'var(--ink-mute)',
                  }}
                >
                  {opt.badge !== null ? opt.badge : (
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>

                {/* テキスト */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm leading-tight"
                    style={{
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      fontWeight: selected ? 600 : 500,
                      color: 'var(--ink)',
                      letterSpacing: '.02em',
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    className="text-xs mt-0.5 leading-tight"
                    style={{ color: 'var(--ink-mute)' }}
                  >
                    {opt.sub}
                  </div>
                </div>

                {/* チェックマーク */}
                {selected && (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--ink)' }}>
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
