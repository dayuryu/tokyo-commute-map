// components/StationDrawer.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConsensusMap, CustomCommutesMap, CustomStation, Destination, Station } from '@/app/page'
import CorrectionReporter from './CorrectionReporter'
import { buildAffiliateLink, ALL_PROGRAMS, type AffiliateProgram, type SuumoStationMap } from '@/lib/affiliate'
import { getDestinationDisplayName, getDestinationTransitName, DESTINATIONS_META } from '@/lib/destinations'
import { getSingleRentLabel, getCoupleRentLabel, type RentMap } from '@/lib/manual-rent'
import { formatGovernmentRent, type GovernmentRentMap } from '@/lib/government-rent'
import { getLineColor, type LineStyleMap } from '@/lib/line-styles'
import type { AreaFeatureMap } from '@/lib/area-features'

// 住居検索アフィリエイトボタン用の短縮ラベル（3 等分カード幅に収まるよう調整）
const AFFILIATE_SHORT_LABELS: Record<AffiliateProgram, string> = {
  suumo:   'SUUMO',
  homes:   "HOME'S",
  chintai: 'CHINTAI',
}

function round5(n: number): number {
  // n <= 0 は destination 自身（自分への通勤時間）。0 のまま表示。
  if (n <= 0) return 0
  // 0 より大きい場合は「ほぼ着いてる距離」も最低 5 分として表示する。
  // 神泉 → 渋谷 (raw 1-2 分) が「0 分」と表示される bug を回避。
  return Math.max(5, Math.round(n / 5) * 5)
}

interface AvgScore {
  review_count: number
  avg_price:    number
  avg_safety:   number
  avg_crowd:    number
}

interface ReviewForm {
  price_score:  number | null
  safety_score: number | null
  crowd_score:  number | null
  comment:      string
}

type ScoreKey = 'price_score' | 'safety_score' | 'crowd_score'

interface Props {
  station:           Station | null
  destination:       Destination
  customStation:     CustomStation | null
  /** custom destination 時の駅 code → 通勤情報 Map（page.tsx で算出）。fixed 時は null。 */
  customCommutes:    CustomCommutesMap
  consensus:         ConsensusMap
  suumoMap:          SuumoStationMap | null
  rentMap:           RentMap
  governmentRent:    GovernmentRentMap
  lineStyles:        LineStyleMap
  areaFeatures:      AreaFeatureMap
  /** AI 推薦リストへの返戻リンクを表示するか — 親側で「現在の駅が aiCache.recs に含まれる」を判定して true を渡す */
  aiRecallAvailable: boolean
  /** 「AI 推薦に戻る」リンク押下時の handler — drawer を閉じてから親側で Wizard を recall 起動 */
  onRecallAi:        () => void
  onSetAsDestination: (station: Station) => void
  onClose:           () => void
}

// 駅が現在の通勤先と同じかを判定。custom は code で、fixed は駅名で照合
// （DESTINATIONS_META の displayName / transitName の両方とマッチさせる）。
function isStationCurrentDestination(
  station: Station,
  destination: Destination,
  customStation: CustomStation | null
): boolean {
  if (destination === 'custom') {
    return customStation?.code === station.code
  }
  const meta = DESTINATIONS_META.find(d => d.slug === destination)
  if (!meta) return false
  // 「東京駅」と「東京」の揺れに対応するため両方とマッチさせる
  return station.name === meta.displayName || station.name === meta.transitName
}

function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

export default function StationDrawer({ station, destination, customStation, customCommutes, consensus, suumoMap, rentMap, governmentRent, lineStyles, areaFeatures, aiRecallAvailable, onRecallAi, onSetAsDestination, onClose }: Props) {
  const [avgScore,   setAvgScore]   = useState<AvgScore | null>(null)
  const [reviews,    setReviews]    = useState<any[]>([])
  const [form,       setForm]       = useState<ReviewForm>({
    price_score: null, safety_score: null, crowd_score: null, comment: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  // ── History API 連携 ──────────────────────────────────────────────
  // 抽屉打开时 pushState、システムバック（popstate）で閉じる。
  // モバイル UX：戻るボタンで地図へ戻れる挙動。
  // pushedRef は「自分が push した entry が history 上に残っているか」を追跡。
  const pushedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!station) {
      // 外部で station=null になった → 自前 entry を消費
      if (pushedRef.current) {
        pushedRef.current = false
        window.history.back()
      }
      return
    }
    if (!pushedRef.current) {
      window.history.pushState({ tcmDrawer: true }, '')
      pushedRef.current = true
    }
    const onPop = () => {
      // システムバック → 抽屉閉じる（自前 entry は browser が既に消費済み）
      pushedRef.current = false
      onClose()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [station, onClose])

  // ── スワイプジェスチャ（右滑り→閉じる、モバイル） ────────────────
  // drawerRef.transform を直接操作して跟手反馈を出す。React state を介さず、
  // 60fps を保つ。close 時は transform をリセットして className 経由の
  // translate-x-full に滑らかに遷移させる。
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const swipeRef = useRef<{
    x0: number
    y0: number
    t0: number
    dir: 'pending' | 'horizontal' | 'vertical'
  } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (!station) return
    swipeRef.current = {
      x0: e.touches[0].clientX,
      y0: e.touches[0].clientY,
      t0: Date.now(),
      dir: 'pending',
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    const s = swipeRef.current
    const el = drawerRef.current
    if (!s || !el) return
    const dx = e.touches[0].clientX - s.x0
    const dy = e.touches[0].clientY - s.y0
    if (s.dir === 'pending') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      // 右向き優位なら横方向 swipe として tracking、それ以外はスクロールに譲る
      if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.dir = 'horizontal'
        el.style.transition = 'none'
      } else {
        s.dir = 'vertical'
      }
    }
    if (s.dir === 'horizontal') {
      el.style.transform = `translateX(${Math.max(0, dx)}px)`
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = swipeRef.current
    const el = drawerRef.current
    swipeRef.current = null
    if (!s || !el || s.dir !== 'horizontal') return
    const dx = e.changedTouches[0].clientX - s.x0
    const dt = Math.max(1, Date.now() - s.t0)
    const vel = dx / dt
    el.style.transition = ''
    el.style.transform = ''
    if (dx > el.offsetWidth * 0.3 || vel > 0.5) {
      onClose()
    }
  }
  function onTouchCancel() {
    const el = drawerRef.current
    swipeRef.current = null
    if (el) {
      el.style.transition = ''
      el.style.transform = ''
    }
  }

  useEffect(() => {
    if (!station) return
    setSubmitted(false)
    setAvgScore(null)
    setReviews([])
    // 駅切替時に評価フォームを「未評価」状態にリセット
    setForm({ price_score: null, safety_score: null, crowd_score: null, comment: '' })
    fetchData(station.code)
  }, [station])

  async function fetchData(code: number) {
    const { data: avg } = await supabase
      .from('station_avg_scores')
      .select('*')
      .eq('station_code', code)
      .single()
    setAvgScore(avg)

    const { data: revs } = await supabase
      .from('station_reviews')
      .select('*')
      .eq('station_code', code)
      .order('created_at', { ascending: false })
      .limit(10)
    setReviews(revs || [])
  }

  // 3 項目すべてに評価が入っているかチェック。null が 1 つでもあれば送信不可。
  const allScored = form.price_score != null
    && form.safety_score != null
    && form.crowd_score != null

  async function submitReview() {
    if (!station || !allScored) return
    setSubmitting(true)
    await supabase.from('station_reviews').insert({
      station_code: station.code,
      station_name: station.name,
      device_id:    getDeviceId(),
      price_score:  form.price_score,
      safety_score: form.safety_score,
      crowd_score:  form.crowd_score,
      comment:      form.comment,
    })
    setSubmitting(false)
    setSubmitted(true)
    fetchData(station.code)
  }

  // custom destination 時は customCommutes (page.tsx で client Dijkstra 算出) から、
  // fixed 時は station の預計算済み min_to_<slug> プロパティから引く。
  // 旧コードは destination==='custom' でも station['min_to_custom'] を見ていたが、
  // selectedStation が stationByName 経由（生 Station オブジェクト、min_to_custom 未注入）
  // で渡る場合、地図 source 経由でない分この値が undefined になり「— 分」表示の bug があった。
  const algorithmMin = !station
    ? null
    : destination === 'custom'
      ? customCommutes?.get(station.code)?.mins ?? undefined
      : station[`min_to_${destination}` as keyof Station] as number | undefined

  // 众包共识值（≥3 票才会出现在 view 中）。custom 目的地不支持校正。
  const consensusEntry = (
    station != null
    && destination !== 'custom'
    && algorithmMin != null
  )
    ? consensus[station.code]?.[destination] ?? null
    : null

  const commuteMin = consensusEntry?.min ?? algorithmMin ?? null

  // Yahoo!乗換案内 への外部リンク
  const destStationName = destination === 'custom'
    ? customStation?.name ?? ''
    : getDestinationTransitName(destination)
  const yahooTransitUrl = (station && commuteMin != null && destStationName)
    ? `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(station.name)}&to=${encodeURIComponent(destStationName)}`
    : null

  // 表示用ラベル — custom destination の場合は実際の駅名を出す（「カスタム」固定文字を回避）
  const destLabel = destination === 'custom'
    ? (customStation?.name ?? 'カスタム')
    : getDestinationDisplayName(destination)

  // 主要路線 — build_stations_geojson_v3.py が station_database/out/main/line/*.json
  // を反向走査して駅 code → 路線名リストとして注入する（MapView 側で Station に展開）。
  const mainLines: string[] = station?.line_names ?? []

  // 家賃目安 — 二層 fallback:
  //   Layer 1 (SUUMO): 101 駅、新築・徒歩 5 分→ 0.9 倍率で徒歩 10 分換算
  //   Layer 2 (政府住宅統計): 1940 駅、市区町村単位の借家全体平均（baseline）
  //   Layer 3 (なし): 残り 100 駅（人口 1.5 万未満の小町村）→「未収録」表示
  const rentRow = station ? rentMap[station.name] : undefined
  const suumoSingle = getSingleRentLabel(rentRow)
  const suumoCouple = getCoupleRentLabel(rentRow)
  const govRentLabel = station && !suumoSingle
    ? formatGovernmentRent(governmentRent[String(station.code)])
    : null
  const rentSource: 'suumo' | 'government' | null =
    suumoSingle ? 'suumo' : govRentLabel ? 'government' : null

  return (
    <>
      {/* backdrop 削除済み — 抽屉打开時も地図交互を維持（pan/zoom/cluster click 全て可）。
          抽屉閉じる手段：右上 × ボタン、モバイル右滑り swipe、ブラウザ戻る (popstate)。 */}
      <div
        ref={drawerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        className={`absolute right-0 top-0 h-full z-30 w-full sm:w-[380px]
                    overflow-y-auto
                    ${station ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          background: '#f4f1ea',
          color: 'var(--ink)',
          fontFamily: 'var(--ui-font, system-ui, sans-serif)',
          boxShadow: '-1px 0 2px rgba(0,0,0,.04), -16px 0 48px rgba(0,0,0,.16)',
          transition: 'transform 350ms cubic-bezier(.2,.8,.2,1)',
          borderLeft: '.5px solid rgba(28,24,18,.10)',
          // iOS Safari の touch スクロール慣性を有効化（駅情報が長いため）
          WebkitOverflowScrolling: 'touch',
          // 縦スクロールは browser native に委任、横 swipe のみ JS で横取りする。
          // これにより drawer 内縦スクロールと map drag の touch event 競合を解消、
          // モバイルで「drawer がスクロールを飲み込む」感覚を防ぐ。
          touchAction: 'pan-y',
        }}
      >
        {station && (
          <div className="px-7 py-7">
            {/* close button — safe-area-inset で notch / 状態バー隠れ防止
                (iPad 横向き split-view、iOS 全屏ノッチ機種で重要) */}
            <button
              onClick={onClose}
              aria-label="close"
              className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              style={{
                top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                color: 'var(--ink-mute)',
                fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            {/* AI 推薦リスト返戻リンク — 招 1: 該当駅が aiCache.recs に含まれる時のみ表示。
                ドロワー内で「リストに戻る」ができるので、ユーザーは Wizard を再起動する
                ためのフロート ボタンを探す必要がない。 */}
            {aiRecallAvailable && (
              <button
                onClick={onRecallAi}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  marginBottom: 14,
                  cursor: 'pointer',
                  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  color: '#a8332b',
                  transition: 'opacity .2s',
                  opacity: 0.92,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.92' }}
              >
                ← AI 推薦 20 駅に戻る
              </button>
            )}

            {/* eyebrow */}
            <div
              className="smallcaps mb-4"
              style={{ color: 'var(--ink-mute)' }}
            >
              STATION · 駅
            </div>

            {/* station name (大字 36px) + romaji */}
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                fontWeight: 600,
                fontSize: 36,
                lineHeight: 1.15,
                letterSpacing: '.01em',
                color: 'var(--ink)',
              }}
            >
              {station.name}
            </h2>
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
                fontStyle: 'italic',
                fontSize: 18,
                color: 'var(--ink-soft)',
                opacity: 0.7,
                letterSpacing: '.01em',
              }}
            >
              Station #{station.code}
            </div>

            {/* 「ここを通勤先にする」アクション — 駅名直下、現在の通勤先と同じなら disabled */}
            {(() => {
              const isCurrent = isStationCurrentDestination(station, destination, customStation)
              return (
                <button
                  onClick={() => { if (!isCurrent) onSetAsDestination(station) }}
                  disabled={isCurrent}
                  style={{
                    marginTop: 14,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '.06em',
                    color: isCurrent ? '#5e7044' : 'var(--pin)',
                    cursor: isCurrent ? 'default' : 'pointer',
                    opacity: isCurrent ? 1 : 0.92,
                    transition: 'opacity .2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.opacity = '0.92' }}
                >
                  {isCurrent ? '✓ 通勤先に設定中' : 'ここを通勤先にする →'}
                </button>
              )
            })()}

            {/* hairline divider */}
            <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />

            {/* big minute number */}
            <div className="flex items-baseline gap-3">
              <span
                className="font-mono-num tabular-nums"
                style={{
                  fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 56,
                  lineHeight: 1,
                  color: 'var(--ink)',
                  letterSpacing: '-.02em',
                }}
              >
                {commuteMin != null ? round5(commuteMin) : '—'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                  fontSize: 14,
                  color: 'var(--ink-soft)',
                  letterSpacing: '.06em',
                }}
              >
                分 to {destLabel}
                {consensusEntry && (
                  <span
                    className="ml-1.5"
                    style={{ color: '#5e7044' }}
                    title={`コミュニティ確認済み（${consensusEntry.count}件の報告）`}
                  >
                    ✓
                  </span>
                )}
              </span>
            </div>

            {yahooTransitUrl && (
              <a
                href={yahooTransitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs underline transition-colors hover:opacity-80"
                style={{ color: 'var(--ink-mute)' }}
              >
                Yahoo!乗換案内で正確な時間を調べる →
              </a>
            )}

            {station != null && algorithmMin != null && (
              <div className="mt-3">
                <CorrectionReporter
                  key={`${station.code}-${destination}`}
                  stationCode={station.code}
                  stationName={station.name}
                  destination={destination}
                  destLabel={destLabel}
                  algorithmMin={algorithmMin}
                />
              </div>
            )}

            {/* 通勤時間 disclaimer — 当サイトの推算精度を明示（通勤時間ブロック直下に配置） */}
            <p
              style={{
                fontFamily: 'var(--display-italic, Garamond, serif)',
                fontStyle: 'italic',
                fontSize: 10.5,
                color: 'var(--ink-mute)',
                letterSpacing: '.02em',
                lineHeight: 1.5,
                margin: '12px 0 0 0',
              }}
            >
              ※通勤時間は当サイト推算値（誤差 ±5〜10 分）です。
            </p>

            {/* hairline divider */}
            <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />

            {/* affiliate 広告 — 住居検索（景表法 PR 表記済み）
                a8mat 未設定時は targetUrl をそのまま開く fallback 動作
                rel="sponsored" は Google + 景表法ガイドラインの推奨 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="smallcaps" style={{ color: 'var(--ink-mute)' }}>
                  住居を探す
                </div>
                <span
                  style={{
                    fontFamily: 'var(--mono, monospace)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.1em',
                    color: 'var(--ink)',
                    background: 'rgba(28,24,18,.08)',
                    padding: '1px 6px',
                    borderRadius: 2,
                  }}
                >
                  PR
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ALL_PROGRAMS.map((id) => (
                  <a
                    key={id}
                    href={buildAffiliateLink(station.name, id, suumoMap ?? undefined)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="text-center transition-opacity hover:opacity-70"
                    style={{
                      padding: '10px 6px',
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      fontSize: 11,
                      color: 'var(--ink)',
                      background: 'rgba(255,255,255,0.5)',
                      border: '.5px solid rgba(28,24,18,.18)',
                      borderRadius: 4,
                      letterSpacing: '.04em',
                      textDecoration: 'none',
                    }}
                  >
                    {AFFILIATE_SHORT_LABELS[id]}
                    <span
                      style={{
                        fontFamily: 'var(--display-italic, Garamond, serif)',
                        marginLeft: 4,
                        fontSize: 10,
                      }}
                    >
                      ↗
                    </span>
                  </a>
                ))}
              </div>
              {/* PR 表記の詳細 link — 景表法ガイドライン推奨 */}
              <p
                style={{
                  fontFamily: 'var(--display-italic, Garamond, serif)',
                  fontStyle: 'italic',
                  fontSize: 10.5,
                  color: 'var(--ink-mute)',
                  letterSpacing: '.02em',
                  lineHeight: 1.5,
                  margin: '8px 0 0 0',
                }}
              >
                <a href="/legal/ads" className="underline" style={{ color: 'var(--ink-mute)' }}>
                  広告について
                </a>
              </p>
            </div>

            {/* hairline divider */}
            <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />

            {/* detail rows: 家賃目安 / 主要路線 / 周辺の特徴 */}
            <div className="space-y-3.5">
              <DetailRow
                label="家賃目安"
                value={
                  rentSource === 'suumo' ? (
                    <span>
                      <span style={{ fontWeight: 600 }}>{suumoSingle}</span>
                      {suumoCouple && (
                        <span style={{ color: 'var(--ink-soft)' }}>
                          {' · 1LDK '}{suumoCouple}
                        </span>
                      )}
                    </span>
                  ) : rentSource === 'government' ? (
                    <span style={{ fontWeight: 600 }}>{govRentLabel}</span>
                  ) : '—'
                }
                hint={
                  rentSource === 'suumo'      ? '徒歩 10 分以内目安 · SUUMO 相場より' :
                  rentSource === 'government' ? '住宅・土地統計調査 · 区平均' :
                                                'データなし（人口 1.5 万未満）'
                }
              />
              <DetailRow
                label="主要路線"
                value={
                  mainLines.length > 0
                    ? <LineList lines={mainLines} styles={lineStyles} />
                    : '—'
                }
                hint={mainLines.length === 0 ? '（データ未接続）' : undefined}
              />
              <AreaFeatureRow features={station ? areaFeatures[station.name] : undefined} />
            </div>

            {/* hairline divider */}
            <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />

            {/* community ratings */}
            {avgScore && avgScore.review_count > 0 && (
              <div className="mb-6">
                <div
                  className="smallcaps mb-3"
                  style={{ color: 'var(--ink-mute)' }}
                >
                  コミュニティ評価 · {avgScore.review_count} 件
                </div>
                {[
                  { label: '物価水準', value: avgScore.avg_price },
                  { label: '治安状況', value: avgScore.avg_safety },
                  { label: '電車混雑', value: avgScore.avg_crowd },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-3 mb-2.5">
                    <span
                      style={{
                        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                        fontSize: 13,
                        color: 'var(--ink)',
                        width: 80,
                        letterSpacing: '.04em',
                      }}
                    >
                      {label}
                    </span>
                    <div
                      className="flex-1 rounded-full h-1.5"
                      style={{ background: 'rgba(28,24,18,.08)' }}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(value / 10) * 100}%`,
                          background: 'var(--ink)',
                        }}
                      />
                    </div>
                    <span
                      className="font-mono-num tabular-nums"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        width: 28,
                        textAlign: 'right',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* review form */}
            {!submitted ? (
              <div>
                <div
                  className="smallcaps mb-3"
                  style={{ color: 'var(--ink-mute)' }}
                >
                  あなたの評価を投稿
                </div>
                <div className="space-y-3.5">
                  {([
                    { key: 'price_score',  label: '物価水準' },
                    { key: 'safety_score', label: '治安状況' },
                    { key: 'crowd_score',  label: '電車混雑' },
                  ] as { key: ScoreKey; label: string }[]).map(({ key, label }) => {
                    const v = form[key]
                    const scored = v != null
                    return (
                      <div key={key}>
                        <div className="flex justify-between mb-1.5">
                          <span
                            style={{
                              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                              fontSize: 13,
                              color: 'var(--ink)',
                              letterSpacing: '.04em',
                            }}
                          >
                            {label}
                          </span>
                          <span
                            className="font-mono-num tabular-nums"
                            style={{
                              fontSize: 12,
                              fontWeight: scored ? 600 : 500,
                              color: scored ? 'var(--ink)' : 'var(--ink-mute)',
                              fontStyle: scored ? 'normal' : 'italic',
                            }}
                          >
                            {scored ? `${v} / 10` : '未評価'}
                          </span>
                        </div>
                        <input
                          type="range" min={1} max={10} step={1}
                          // 未評価時は中央表示（5）にしておくが、value はあくまで null。
                          // input 操作（change/click/touch）で初めて数値化する。
                          value={scored ? v : 5}
                          onChange={(e) => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                          // モバイル：タッチで初回スコア確定
                          onTouchStart={() => {
                            if (!scored) setForm(f => ({ ...f, [key]: 5 }))
                          }}
                          // デスクトップ：クリック確定（タッチ環境ではこれも発火するため重複セットを避ける）
                          onClick={() => {
                            if (!scored) setForm(f => ({ ...f, [key]: 5 }))
                          }}
                          className="pretty w-full"
                          style={{ opacity: scored ? 1 : 0.45 }}
                          aria-valuetext={scored ? `${v} / 10` : '未評価'}
                        />
                      </div>
                    )
                  })}
                  <textarea
                    placeholder="一言コメント（任意）..."
                    value={form.comment}
                    onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
                    /* text-[16px] で iOS Safari focus 時の自動 zoom 防止 */
                    className="w-full p-3 text-[16px] resize-none h-20 focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.6)',
                      border: '.5px solid rgba(28,24,18,.18)',
                      borderRadius: 4,
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      color: 'var(--ink)',
                      letterSpacing: '.02em',
                    }}
                  />
                  <button
                    onClick={submitReview}
                    disabled={submitting || !allScored}
                    className="w-full transition-all disabled:opacity-40 hover:opacity-90"
                    style={{
                      padding: '14px 0',
                      background: 'var(--ink)',
                      color: '#f5e7d2',
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      fontWeight: 600,
                      fontSize: 14,
                      letterSpacing: '.06em',
                      borderRadius: 0,
                      cursor: submitting
                        ? 'wait'
                        : (allScored ? 'pointer' : 'not-allowed'),
                    }}
                    title={allScored ? '' : '3 項目すべて評価してください'}
                  >
                    {submitting
                      ? '送信中…'
                      : (allScored ? '投稿する' : '3 項目を評価してください')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="text-center py-4"
                style={{
                  fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                  fontSize: 14,
                  color: '#5e7044',
                  fontWeight: 600,
                  letterSpacing: '.06em',
                }}
              >
                ✓ 投稿ありがとうございます
              </div>
            )}

            {/* recent comments */}
            {reviews.filter(r => r.comment).length > 0 && (
              <>
                <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />
                <div
                  className="smallcaps mb-3"
                  style={{ color: 'var(--ink-mute)' }}
                >
                  最新コメント
                </div>
                <div className="space-y-2.5">
                  {reviews.filter(r => r.comment).map((r) => (
                    <div
                      key={r.id}
                      className="px-3.5 py-3 text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.5)',
                        border: '.5px solid rgba(28,24,18,.08)',
                        borderRadius: 4,
                        fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                        color: 'var(--ink)',
                        lineHeight: 1.7,
                        letterSpacing: '.02em',
                      }}
                    >
                      <p className="m-0">{r.comment}</p>
                      <p
                        className="m-0 mt-1"
                        style={{
                          fontFamily: 'var(--mono, monospace)',
                          fontSize: 10,
                          color: 'var(--ink-mute)',
                          letterSpacing: '.1em',
                        }}
                      >
                        {new Date(r.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── detail row helper ─────────────────────────────────────────────
// ── 主要路線リスト（方案 D：左側色條 + 路線名） ──────────────────────
// 各路線を「3.5px の色条 + 路線名」のインライン span として並べる。
// 1 駅あたり最大 14 路線なので、自然な flex-wrap で 2-4 行に折り返す想定。
// whiteSpace: nowrap で各 item が内部で折れないようにし、コンテナ側で行替えする。
function LineList({ lines, styles }: { lines: string[]; styles: LineStyleMap }) {
  return (
    <span style={{ display: 'inline', lineHeight: 1.95 }}>
      {lines.map((name, i) => (
        <span
          key={`${name}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginRight: 12,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 3.5,
              height: 14,
              borderRadius: 1,
              flexShrink: 0,
              background: getLineColor(name, styles),
            }}
          />
          <span>{name}</span>
        </span>
      ))}
    </span>
  )
}

// ── 周辺の特徴（AI 要約） ──────────────────────────────────────────
// DetailRow と違って 50〜75 字の長文を 3〜4 行で展開するため、
// label を上に独立配置 + 本文を block で流す。AI 生成の disclaimer は
// 景表法配慮で「参考情報・現地確認」を明示する。
function AreaFeatureRow({ features }: { features: string | undefined }) {
  const hasText = features != null && features.trim().length > 0
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--mono, monospace)',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.18em',
          color: 'var(--ink-mute)',
          marginBottom: 6,
        }}
      >
        周辺の特徴
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontSize: 14,
          lineHeight: 1.8,
          color: 'var(--ink)',
          letterSpacing: '.02em',
        }}
      >
        {hasText ? features : '—'}
      </p>
      <p
        style={{
          margin: '6px 0 0 0',
          fontFamily: 'var(--display-italic, Garamond, serif)',
          fontStyle: 'italic',
          fontSize: 10.5,
          color: 'var(--ink-mute)',
          letterSpacing: '.02em',
          lineHeight: 1.5,
        }}
      >
        {hasText ? 'ChatGPT による要約・参考情報。最新の街の様子は現地でご確認ください。' : '（データなし）'}
      </p>
    </div>
  )
}

function DetailRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <div
        style={{
          width: 80,
          flexShrink: 0,
          fontFamily: 'var(--mono, monospace)',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.18em',
          color: 'var(--ink-mute)',
        }}
      >
        {label}
      </div>
      <div
        className="flex-1"
        style={{
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontSize: 14,
          color: 'var(--ink)',
          letterSpacing: '.02em',
        }}
      >
        {value}
        {hint && (
          <span
            className="ml-2"
            style={{
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 11,
              color: 'var(--ink-mute)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  )
}
