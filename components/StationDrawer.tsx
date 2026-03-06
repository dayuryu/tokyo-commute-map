// components/StationDrawer.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Destination, Station } from '@/app/page'

const DEST_LABELS: Record<Destination, string> = {
  shinjuku: '新宿',
  shibuya:  '渋谷',
  tokyo:    '東京駅',
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
  station:     Station | null
  destination: Destination
  onClose:     () => void
}

function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

export default function StationDrawer({ station, destination, onClose }: Props) {
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

  const commuteMin = station
    ? station[`min_to_${destination}` as keyof Station] as number
    : null

  return (
    <>
      {station && (
        <div className="absolute inset-0 z-20 bg-black/20" onClick={onClose} />
      )}

      <div className={`absolute right-0 top-0 h-full z-30 w-full max-w-sm
                       bg-white shadow-2xl overflow-y-auto
                       transition-transform duration-300
                       ${station ? 'translate-x-0' : 'translate-x-full'}`}>
        {station && (
          <div className="p-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{station.name}</h2>
              <button onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            {/* 硬数据 */}
            <div className="bg-blue-50 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {commuteMin ?? '--'}
                </div>
                <div className="text-xs text-gray-500">分→{DEST_LABELS[destination]}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">
                  {avgScore?.avg_crowd ?? '--'}
                </div>
                <div className="text-xs text-gray-500">混雑スコア</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {avgScore?.review_count ?? 0}
                </div>
                <div className="text-xs text-gray-500">口コミ数</div>
              </div>
            </div>

            {/* 平均分条形图 */}
            {avgScore && avgScore.review_count > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">コミュニティ評価</h3>
                {[
                  { label: '💰 物価水準', value: avgScore.avg_price },
                  { label: '🔒 治安状況', value: avgScore.avg_safety },
                  { label: '🚃 電車混雑', value: avgScore.avg_crowd },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-3 mb-2">
                    <span className="text-sm w-24">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all"
                           style={{ width: `${(value / 10) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold w-6 text-right">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 投稿フォーム */}
            {!submitted ? (
              <div className="border-t pt-5">
                <h3 className="font-semibold text-gray-700 mb-4">あなたの評価を投稿</h3>
                <div className="space-y-4">
                  {[
                    { key: 'price_score',  label: '💰 物価水準' },
                    { key: 'safety_score', label: '🔒 治安状況' },
                    { key: 'crowd_score',  label: '🚃 電車混雑' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{label}</span>
                        <span className="font-bold">
                          {form[key as keyof ReviewForm]} / 10
                        </span>
                      </div>
                      <input type="range" min={1} max={10} step={1}
                        value={form[key as keyof ReviewForm] as number}
                        onChange={(e) => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  ))}
                  <textarea
                    placeholder="一言コメント（任意）..."
                    value={form.comment}
                    onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
                    className="w-full border rounded-xl p-3 text-sm resize-none h-20
                               focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button onClick={submitReview} disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white
                               font-semibold py-3 rounded-xl transition-colors
                               disabled:opacity-50">
                    {submitting ? '送信中...' : '投稿する'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t pt-5 text-center text-green-600 font-semibold">
                ✅ 投稿ありがとうございます！
              </div>
            )}

            {/* 最新コメント */}
            {reviews.filter(r => r.comment).length > 0 && (
              <div className="border-t pt-5 mt-5">
                <h3 className="font-semibold text-gray-700 mb-3">最新コメント</h3>
                {reviews.filter(r => r.comment).map((r) => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-3 text-sm mb-2">
                    <p className="text-gray-700">{r.comment}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(r.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
