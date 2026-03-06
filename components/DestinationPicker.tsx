// components/DestinationPicker.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import type { Destination, CustomStation } from '@/app/page'

const OPTIONS: { value: Destination; label: string }[] = [
  { value: 'shinjuku', label: '新宿' },
  { value: 'shibuya',  label: '渋谷' },
  { value: 'tokyo',    label: '東京駅' },
]

interface Props {
  value: Destination
  onChange: (v: Destination) => void
  stationList: CustomStation[]
  customStation: CustomStation | null
  onCustomChange: (s: CustomStation) => void
}

export default function DestinationPicker({ value, onChange, stationList, customStation, onCustomChange }: Props) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.length >= 1
    ? stationList.filter(s => s.name.includes(query)).slice(0, 8)
    : []

  // カスタム駅が選択されている状態
  const isCustomMode = value === 'custom' && !!customStation

  // タブを表示するか（検索中でもカスタムモードでもない）
  const showTabs = !searchActive && !isCustomMode

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        if (!isCustomMode) {
          setSearchActive(false)
          setQuery('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCustomMode])

  function activateSearch() {
    setSearchActive(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function deactivateSearch() {
    setSearchActive(false)
    setQuery('')
    setShowDropdown(false)
  }

  function selectCustomStation(station: CustomStation) {
    onCustomChange(station)
    setQuery('')
    setShowDropdown(false)
  }

  function clearCustom() {
    onChange('shinjuku')
    setQuery('')
    setSearchActive(false)
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1">

      {/* ── 固定タブ（検索/カスタムモード時は折りたたむ） ── */}
      <div
        className="flex items-center gap-1 overflow-hidden transition-all duration-300"
        style={{ maxWidth: showTabs ? '240px' : '0px', opacity: showTabs ? 1 : 0 }}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${value === opt.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            {opt.label}
          </button>
        ))}
        {/* 検索アイコンボタン */}
        <button
          onClick={activateSearch}
          className="px-2 py-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all text-sm leading-none"
          title="駅を検索"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      {/* ── 検索/カスタムモード（タブ非表示時に展開） ── */}
      <div
        className="flex items-center gap-1 transition-all duration-300"
        style={{
          maxWidth: !showTabs ? '280px' : '0px',
          opacity: !showTabs ? 1 : 0,
          overflow: showTabs ? 'hidden' : 'visible',
        }}
      >
        {isCustomMode ? (
          /* カスタム駅チップ */
          <div className="flex items-center gap-1 px-3 py-1 rounded-xl text-sm font-medium bg-blue-600 text-white shadow-sm whitespace-nowrap">
            <span>{customStation.name}</span>
            <button onClick={clearCustom} className="ml-1 hover:opacity-70 leading-none">×</button>
          </div>
        ) : (
          /* 検索入力 + ドロップダウン */
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') deactivateSearch()
                if (e.key === 'Enter' && filtered.length > 0) selectCustomStation(filtered[0])
              }}
              placeholder="駅を検索..."
              className="w-36 px-3 py-1 rounded-xl text-sm border border-gray-200
                         focus:outline-none focus:border-blue-400 bg-white/80"
            />
            {showDropdown && filtered.length > 0 && (
              <div className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-lg
                              border border-gray-100 py-1 z-50 w-44 max-h-60 overflow-y-auto">
                {filtered.map(s => (
                  <button
                    key={s.code}
                    onClick={() => selectCustomStation(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors whitespace-nowrap"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 戻るボタン（検索中のみ） */}
        {!isCustomMode && (
          <button
            onClick={deactivateSearch}
            className="px-2 py-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all text-sm leading-none"
          >
            ✕
          </button>
        )}
      </div>

    </div>
  )
}
