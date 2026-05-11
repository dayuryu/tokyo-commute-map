// components/StationDrawer.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConsensusMap, CustomStation, Destination, Station } from '@/app/page'
import CorrectionReporter from './CorrectionReporter'

const DEST_LABELS: Record<Destination, string> = {
  shinjuku: '新宿',
  shibuya:  '渋谷',
  tokyo:    '東京駅',
  custom:   'カスタム',
}

// Yahoo!乗換案内 検索用の駅名（DEST_LABELS は表示用、こちらは検索クエリ用）
const DEST_TRANSIT_NAMES: Record<Exclude<Destination, 'custom'>, string> = {
  shinjuku: '新宿',
  shibuya:  '渋谷',
  tokyo:    '東京',
}

function round5(n: number): number {
  return Math.round(n / 5) * 5
}

interface AvgScore {
  review_count: number
  avg_price:    number
  avg_safety:   number
  avg_crowd:    number
}

interface ReviewForm {
  price_score:  number
  safety_score: number
  crowd_score:  number
  comment:      string
}

interface Props {
  station:       Station | null
  destination:   Destination
  customStation: CustomStation | null
  consensus:     ConsensusMap
  onClose:       () => void
}

function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

export default function StationDrawer({ station, destination, customStation, consensus, onClose }: Props) {
  const [avgScore,   setAvgScore]   = useState<AvgScore | null>(null)
  const [reviews,    setReviews]    = useState<any[]>([])
  const [form,       setForm]       = useState<ReviewForm>({
    price_score: 5, safety_score: 5, crowd_score: 5, comment: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  useEffect(() => {
    if (!station) return
    setSubmitted(false)
    setAvgScore(null)
    setReviews([])
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

  async function submitReview() {
    if (!station) return
    setSubmitting(true)
    await supabase.from('station_reviews').insert({
      station_code: station.code,
      station_name: station.name,
      device_id:    getDeviceId(),
      ...form,
    })
    setSubmitting(false)
    setSubmitted(true)
    fetchData(station.code)
  }

  const algorithmMin = station
    ? station[`min_to_${destination}` as keyof Station] as number | undefined
    : null

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
    : DEST_TRANSIT_NAMES[destination]
  const yahooTransitUrl = (station && commuteMin != null && destStationName)
    ? `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(station.name)}&to=${encodeURIComponent(destStationName)}`
    : null

  // 主要路線 — stations.geojson の register.csv 由来 line タグが現状未注入のためプレースホルダ
  // 後続で stations.geojson 構築時に line_names を持たせれば即接続可能
  const mainLines: string[] = []  // TODO: 実データに接続

  return (
    <>
      {station && (
        <div
          className="absolute inset-0 z-20"
          style={{ background: 'rgba(28,24,18,0.18)' }}
          onClick={onClose}
        />
      )}

      <div
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
        }}
      >
        {station && (
          <div className="px-7 py-7">
            {/* close button */}
            <button
              onClick={onClose}
              aria-label="close"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              style={{
                color: 'var(--ink-mute)',
                fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ×
            </button>

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
                分 to {DEST_LABELS[destination]}
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

            {station != null && destination !== 'custom' && algorithmMin != null && (
              <div className="mt-3">
                <CorrectionReporter
                  key={`${station.code}-${destination}`}
                  stationCode={station.code}
                  stationName={station.name}
                  destination={destination}
                  algorithmMin={algorithmMin}
                />
              </div>
            )}

            {/* hairline divider */}
            <div className="h-px my-6" style={{ background: 'rgba(28,24,18,.10)' }} />

            {/* detail rows: 家賃目安 / 主要路線 / 周辺の特徴 */}
            <div className="space-y-3.5">
              <DetailRow label="家賃目安" value="—" hint="（データ未接続）" />
              <DetailRow
                label="主要路線"
                value={mainLines.length > 0 ? mainLines.join('・') : '—'}
                hint={mainLines.length === 0 ? '（データ未接続）' : undefined}
              />
              <DetailRow
                label="周辺の特徴"
                value={avgScore?.review_count ? '—' : '—'}
                hint="（口コミから生成）"
              />
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
                  {[
                    { key: 'price_score',  label: '物価水準' },
                    { key: 'safety_score', label: '治安状況' },
                    { key: 'crowd_score',  label: '電車混雑' },
                  ].map(({ key, label }) => (
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
                            fontWeight: 600,
                            color: 'var(--ink)',
                          }}
                        >
                          {form[key as keyof ReviewForm]} / 10
                        </span>
                      </div>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={form[key as keyof ReviewForm] as number}
                        onChange={(e) => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                        className="pretty w-full"
                      />
                    </div>
                  ))}
                  <textarea
                    placeholder="一言コメント（任意）..."
                    value={form.comment}
                    onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
                    className="w-full p-3 text-sm resize-none h-20 focus:outline-none"
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
                    onClick={submitReview} disabled={submitting}
                    className="w-full transition-all disabled:opacity-50 hover:opacity-90"
                    style={{
                      padding: '14px 0',
                      background: 'var(--ink)',
                      color: '#f5e7d2',
                      fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                      fontWeight: 600,
                      fontSize: 14,
                      letterSpacing: '.06em',
                      borderRadius: 0,
                      cursor: submitting ? 'wait' : 'pointer',
                    }}
                  >
                    {submitting ? '送信中…' : '投稿する'}
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
function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
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
