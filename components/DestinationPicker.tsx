// components/DestinationPicker.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslations, useLocale } from 'next-intl'
import type { CustomStation, WizardDestination } from '@/lib/types'
import {
  QUICK_DESTINATIONS,
  DESTINATIONS_META,
  getDestinationDisplayName,
  type FixedDestination,
} from '@/lib/destinations'
import { stationListAtom } from '@/lib/atoms/data'
import { stationLabel, stationMatches } from '@/lib/station-label'
import { destinationLabel } from '@/lib/destinations'
import {
  destinationAtom,
  customStationAtom,
  setDestinationAtom,
  secondDestinationAtom,
  secondCustomStationAtom,
  setSecondDestinationAtom,
} from '@/lib/atoms/domain'

// label は locale 依存のため render 時に destinationLabel() で決める
const OPTIONS = QUICK_DESTINATIONS.map(d => ({
  value: d.slug as FixedDestination,
  meta: d,
}))

// 駅名 → fixed destination slug の逆引きマップ。検索選択時に
// 30 駅のいずれかに一致したら custom ではなく fixed として扱う。
const NAME_TO_FIXED_SLUG: Record<string, FixedDestination> = (() => {
  const m: Record<string, FixedDestination> = {}
  for (const d of DESTINATIONS_META) {
    m[d.displayName] = d.slug as FixedDestination
    m[d.transitName] = d.slug as FixedDestination
  }
  return m
})()

export default function DestinationPicker() {
  const t = useTranslations('destinationPicker')
  const locale = useLocale()
  const stationList = useAtomValue(stationListAtom)
  // domain atom を自取 — props drilling を解消（ADR-0003 P3）。
  const value = useAtomValue(destinationAtom)
  const customStation = useAtomValue(customStationAtom)
  const setDestination = useSetAtom(setDestinationAtom)
  const secondValue = useAtomValue(secondDestinationAtom)
  const secondCustomStation = useAtomValue(secondCustomStationAtom)
  const setSecondDestination = useSetAtom(setSecondDestinationAtom)
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  // 検索結果の書き込み先 — 'first' は通常の目的地切替、'second' は「＋」からの 2 拠点目追加
  const [searchTarget, setSearchTarget] = useState<'first' | 'second'>('first')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.length >= 1
    ? stationList.filter(s => stationMatches(s, query)).slice(0, 8)
    : []

  // カスタム駅が選択されている状態
  const isCustomMode = value === 'custom' && !!customStation

  // タブを表示するか（検索中でもカスタムモードでもない）
  const showTabs = !searchActive && !isCustomMode

  // 2 つ目の目的地の表示ラベル（fixed は display 名、custom は駅名）
  const secondLabel = secondValue === 'custom'
    ? (secondCustomStation ? stationLabel(secondCustomStation, locale) : '')
    : secondValue !== null ? getDestinationDisplayName(secondValue, locale) : ''

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setSearchActive(false)
        setSearchTarget('first')
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function activateSearch(target: 'first' | 'second' = 'first') {
    setSearchTarget(target)
    setSearchActive(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function deactivateSearch() {
    // blur を明示 — 折りたたみは input を DOM に残す（maxWidth:0）ため、iOS Safari では
    // ボタンタップで focus が input から外れず、不可視 input がソフトキーボードを
    // 開いたまま残す（モバイル実機で報告された「残留」）。
    inputRef.current?.blur()
    setSearchActive(false)
    setSearchTarget('first')
    setQuery('')
    setShowDropdown(false)
  }

  function selectCustomStation(station: CustomStation) {
    // 30 個の fixed destination のいずれかに一致したら精度の高い fixed として扱う
    // （min_to_<slug> がプリ計算済み）。それ以外は custom（client Dijkstra）。
    const fixedSlug = NAME_TO_FIXED_SLUG[station.name]
    const target: WizardDestination = fixedSlug
      ? { kind: 'fixed', slug: fixedSlug }
      : { kind: 'custom', station }
    if (searchTarget === 'second') {
      // primary と同一駅は二拠点として無意味 → 設定せず検索だけ閉じる
      const samePrimary = fixedSlug
        ? value === fixedSlug
        : customStation?.code === station.code
      if (!samePrimary) setSecondDestination(target)
      deactivateSearch()
      return
    }
    setDestination(target)
    // fixed / custom どちらの選択でも検索を完全に閉じる。旧実装は fixed 選択時に
    // 検索 input を開いたまま残しており（custom 時のみ chip 表示へ遷移）、モバイル
    // では「選んだのに検索欄が残留する」非対称な挙動だった。
    deactivateSearch()
  }

  function clearCustom() {
    setDestination({ kind: 'fixed', slug: 'shinjuku' })
    setQuery('')
    setSearchActive(false)
  }

  function clearSecond() {
    setSecondDestination(null)
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
            onClick={() => setDestination({ kind: 'fixed', slug: opt.value })}
            className={`px-3 py-1 rounded text-sm transition-all whitespace-nowrap
              ${value === opt.value
                ? 'shadow-sm'
                : 'hover:bg-black/5'
              }`}
            style={{
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              fontWeight: value === opt.value ? 600 : 500,
              letterSpacing: '.04em',
              background: value === opt.value ? 'var(--ink)' : 'transparent',
              color: value === opt.value ? '#f5e7d2' : 'var(--ink-soft)',
            }}
          >
            {destinationLabel(opt.meta, locale)}
          </button>
        ))}
        {/* 検索アイコンボタン */}
        <button
          onClick={() => activateSearch('first')}
          className="px-2 py-1 rounded hover:bg-black/5 transition-all text-sm leading-none"
          style={{ color: 'var(--ink-mute)' }}
          title={t('searchTitle')}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      {/* ── 検索/カスタムモード（タブ非表示時に展開） ──
          searchActive 優先 — primary が custom のままでも「＋」(second) の検索入力を出せる */}
      <div
        className="flex items-center gap-1 transition-all duration-300"
        style={{
          maxWidth: !showTabs ? '280px' : '0px',
          opacity: !showTabs ? 1 : 0,
          overflow: showTabs ? 'hidden' : 'visible',
        }}
      >
        {isCustomMode && !searchActive ? (
          /* カスタム駅チップ */
          <div
            className="flex items-center gap-1 px-3 py-1 rounded text-sm shadow-sm whitespace-nowrap"
            style={{
              background: 'var(--ink)',
              color: '#f5e7d2',
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              fontWeight: 600,
              letterSpacing: '.04em',
            }}
          >
            <span>{stationLabel(customStation, locale)}</span>
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
              placeholder={t('searchPlaceholder')}
              /* text-[16px] で iOS Safari focus 時の自動 zoom 防止（< 16px は強制拡大される） */
              className="w-36 px-3 py-1 rounded text-[16px] bg-white/80 focus:outline-none transition-colors"
              style={{
                border: '.5px solid rgba(28,24,18,.18)',
                fontFamily: 'var(--ui-font, system-ui, sans-serif)',
                color: 'var(--ink)',
              }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--ink)' }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(28,24,18,.18)' }}
            />
            {showDropdown && filtered.length > 0 && (
              <div
                className="absolute top-full mt-1 left-0 rounded-xl shadow-lg py-1 z-50 w-44 overflow-y-auto max-h-[min(15rem,calc(100dvh-120px))]"
                style={{
                  background: 'rgba(244, 241, 234, 0.95)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  border: '.5px solid rgba(28,24,18,.10)',
                }}
              >
                {filtered.map(s => (
                  <button
                    key={s.code}
                    onClick={() => selectCustomStation(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors whitespace-nowrap"
                    style={{
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      color: 'var(--ink)',
                      letterSpacing: '.02em',
                    }}
                  >
                    {stationLabel(s, locale)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 戻るボタン（検索中のみ） */}
        {searchActive && (
          <button
            onClick={deactivateSearch}
            className="px-2 py-1 rounded hover:bg-black/5 transition-all text-sm leading-none"
            style={{ color: 'var(--ink-mute)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── 2 つ目の目的地（二拠点通勤） ── */}
      {secondValue !== null ? (
        <div
          className="flex items-center gap-1 px-3 py-1 rounded text-sm shadow-sm whitespace-nowrap"
          style={{
            background: 'var(--ink)',
            color: '#f5e7d2',
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            letterSpacing: '.04em',
          }}
          title={t('secondChipTitle')}
        >
          <span style={{ opacity: 0.65, fontWeight: 500 }}>＋</span>
          <span>{secondLabel}</span>
          <button onClick={clearSecond} className="ml-1 hover:opacity-70 leading-none">×</button>
        </div>
      ) : (
        /* 未設定時は「＋ 目的地を追加」のゴーストチップ — 破線枠で
           「ここにもう 1 つチップを置ける」ことを視覚的に伝える。
           検索中はタブ列と同じ collapse アニメで畳む（条件 render で即 mount/unmount
           すると、検索容器の 300ms 収縮中にチップがカード右縁へ押し出されてから
           滑り戻る「弾入残影」が出るため、常時 mount + maxWidth 遷移で対称にする） */
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxWidth: searchActive ? '0px' : '200px', opacity: searchActive ? 0 : 1 }}
        >
          <button
            onClick={() => activateSearch('second')}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-sm whitespace-nowrap hover:bg-black/5 transition-all"
            style={{
              border: '1px dashed rgba(28,24,18,.35)',
              color: 'var(--ink-soft)',
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              letterSpacing: '.04em',
            }}
            title={t('addSecondTitle')}
            tabIndex={searchActive ? -1 : 0}
          >
            <span style={{ fontWeight: 600 }}>＋</span>
            {/* 狭幅（mobile）ではタブ列を圧迫しないよう短縮ラベル */}
            <span className="hidden sm:inline">{t('addSecondLabel')}</span>
            <span className="sm:hidden">{t('addSecondLabelShort')}</span>
          </button>
        </div>
      )}

    </div>
  )
}
