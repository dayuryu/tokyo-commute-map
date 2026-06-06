'use client'
import { useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslations, useLocale } from 'next-intl'
import {
  favoritesPanelOpenAtom,
  favoriteStationsAtom,
  toggleFavoriteAtom,
} from '@/lib/atoms/favorites'
import { selectedStationAtom } from '@/lib/atoms/ui'
import { destinationAtom, customStationAtom } from '@/lib/atoms/domain'
import { customCommutesAtom } from '@/lib/atoms/derived'
import { stationLabel } from '@/lib/station-label'
import { getDestinationDisplayName } from '@/lib/destinations'
import { round5 } from '@/lib/buckets'
import { MAX_FAVORITES } from '@/lib/constants'
import type { Station } from '@/lib/types'

/**
 * お気に入り駅リスト面板。HeaderMenu の「お気に入り」から開く。
 *
 * - 行クリック → selectedStationAtom に書く → MapView が flyTo + StationDrawer が開く
 *   （地図クリックと同じ経路。お気に入りの Station は stationByName 由来の完全
 *   オブジェクトなので drawer の通勤時間もそのまま表示される）
 * - ★ クリック → 解除（行クリックとは stopPropagation で分離）
 * - 通勤時間は現在の通勤先基準。fixed は預計算 min_to_*、custom は client Dijkstra。
 *   表示丸めは drawer と同じ round5（5 分刻み模糊化）。
 * - 開閉状態は favoritesPanelOpenAtom — HeaderMenu が開き、backdrop / ESC / × が閉じる。
 */
export default function FavoritesPanel() {
  const t = useTranslations('favorites')
  const locale = useLocale()
  const [open, setOpen] = useAtom(favoritesPanelOpenAtom)
  const stations = useAtomValue(favoriteStationsAtom)
  const toggleFavorite = useSetAtom(toggleFavoriteAtom)
  const setSelectedStation = useSetAtom(selectedStationAtom)
  const destination = useAtomValue(destinationAtom)
  const customStation = useAtomValue(customStationAtom)
  const customCommutes = useAtomValue(customCommutesAtom)

  // ESC で閉じる（開いている間のみ listener を張る）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const destLabel =
    destination === 'custom'
      ? customStation
        ? stationLabel(customStation, locale)
        : '—'
      : getDestinationDisplayName(destination, locale)

  /** 現通勤先への分数（5 分刻み丸め）。データ未到着 / 未算出は null。 */
  const minutesOf = (s: Station): number | null => {
    const raw =
      destination === 'custom'
        ? customCommutes?.get(s.code)?.mins
        : (s[`min_to_${destination}` as keyof Station] as number | undefined)
    return raw == null ? null : round5(raw)
  }

  return (
    <>
      {/* backdrop — 透明、クリックで閉じる */}
      <div className="fixed inset-0 z-[25]" onClick={() => setOpen(false)} />

      {/* card — HeaderMenu dropdown と同じ editorial ガラス調 */}
      <div
        role="dialog"
        aria-label={t('title')}
        className="fixed z-30 rounded-2xl overflow-hidden flex flex-col"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
          right: 'max(12px, env(safe-area-inset-right, 0px))',
          width: 'min(320px, calc(100vw - 24px))',
          maxHeight: 'min(60dvh, 520px)',
          background: 'rgba(244, 241, 234, 0.96)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '.5px solid rgba(28,24,18,.10)',
          boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.18)',
        }}
      >
        {/* header */}
        <div
          className="flex items-center gap-2 px-4 pt-3.5 pb-2.5"
          style={{ borderBottom: '.5px solid rgba(28,24,18,.08)' }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 1 }}>★</span>
          <span
            className="flex-1 text-sm"
            style={{
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              fontWeight: 600,
              letterSpacing: '.02em',
              color: 'var(--ink)',
            }}
          >
            {t('title')}
          </span>
          <span
            style={{
              fontFamily: 'var(--mono, ui-monospace, monospace)',
              fontSize: 11,
              color: 'var(--ink-mute)',
              letterSpacing: '.08em',
            }}
          >
            {stations.length}/{MAX_FAVORITES}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('close')}
            className="ml-1 w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[.06] transition-colors"
            style={{ color: 'var(--ink-soft)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {stations.length > 0 ? (
          <>
            {/* 現通勤先の注記 */}
            <div
              className="px-4 pt-2 pb-1 text-xs"
              style={{ color: 'var(--ink-mute)', letterSpacing: '.02em' }}
            >
              {t('commuteTo', { dest: destLabel })}
            </div>

            {/* list */}
            <div className="overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
              {stations.map((s) => {
                const min = minutesOf(s)
                return (
                  <div
                    key={s.code}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedStation(s)
                      setOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedStation(s)
                        setOpen(false)
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left cursor-pointer hover:bg-black/[.04] transition-colors"
                  >
                    {/* 解除 ★ — 行クリックと分離 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(s.code)
                      }}
                      aria-label={t('remove', { station: stationLabel(s, locale) })}
                      className="flex-shrink-0 w-8 h-8 -ml-1.5 flex items-center justify-center
                                 transition-transform duration-150 hover:scale-115 active:scale-95"
                      style={{
                        fontSize: 17,
                        lineHeight: 1,
                        color: 'var(--accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      ★
                    </button>
                    <span
                      className="flex-1 min-w-0 truncate text-sm"
                      style={{
                        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                        fontWeight: 600,
                        letterSpacing: '.01em',
                        color: 'var(--ink)',
                      }}
                    >
                      {stationLabel(s, locale)}
                    </span>
                    <span
                      className="flex-shrink-0"
                      style={{
                        fontFamily: 'var(--mono, ui-monospace, monospace)',
                        fontSize: 12,
                        color: min == null ? 'var(--ink-mute)' : 'var(--ink-soft)',
                        letterSpacing: '.04em',
                      }}
                    >
                      {min == null ? '—' : t('minutes', { min })}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* empty state */
          <div className="px-5 py-7 text-center">
            <div style={{ fontSize: 22, color: 'var(--ink-mute)', opacity: 0.6 }}>☆</div>
            <div
              className="mt-2 text-sm"
              style={{
                fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                fontWeight: 600,
                color: 'var(--ink-soft)',
              }}
            >
              {t('emptyTitle')}
            </div>
            <div className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--ink-mute)' }}>
              {t('emptyHint')}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
