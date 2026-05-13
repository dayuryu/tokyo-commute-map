/**
 * AI 推薦の Supabase キャッシュ層
 *
 * - cache_key = SHA-256(6 問答え serialize)
 * - 30 日 TTL（AI モデル / データ更新で旧キャッシュは自動失効）
 * - custom destination は cache しない（lat/lng 編入で命中率ほぼ 0、ノイズ防止）
 * - hit_count は async で +1、失敗は silent（cache の操作で機能を壊さない）
 *
 * Supabase クライアントは既存 lib/supabase.ts の anon key を再利用。
 * Route Handler は server-side で動くため anon でも secret は leak しない。
 */

import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import type { WizardAnswers, Recommendation } from './types'

const CACHE_TTL_DAYS = 30

/**
 * 6 問答えを正規化して SHA-256 で hash。
 * key の順序を固定にすることで JSON.stringify の決定性を担保。
 */
export function buildCacheKey(answers: WizardAnswers): string {
  const normalized = JSON.stringify({
    d: answers.destination,
    m: answers.maxMinutes,
    r: answers.rentMax,
    h: answers.household,
    a: answers.atmosphere,
    s: answers.safety,
  })
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * cache 対象かどうかを判定。
 * custom destination は実質ほぼユニークなので cache しない。
 */
export function isCacheable(answers: WizardAnswers): boolean {
  return answers.destination !== 'custom'
}

/**
 * cache lookup。命中時は Recommendation[]、それ以外は null。
 * 30 日以上前のレコードは無視（generated_at で filter）。
 * 命中時は hit_count を +1（async、await しない）。
 */
export async function lookupCache(cacheKey: string): Promise<Recommendation[] | null> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS)

  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('id, recommendations, hit_count')
    .eq('cache_key', cacheKey)
    .gte('generated_at', cutoff.toISOString())
    .maybeSingle()

  if (error) {
    console.warn('[cache] lookup error (treat as miss):', error.message)
    return null
  }
  if (!data) return null

  // hit_count を非同期で +1（response を待たせない）
  void supabase
    .from('ai_recommendations')
    .update({ hit_count: (data.hit_count ?? 0) + 1 })
    .eq('id', data.id)
    .then(({ error: updErr }) => {
      if (updErr) console.warn('[cache] hit_count update error:', updErr.message)
    })

  return data.recommendations as Recommendation[]
}

/**
 * 新しい推薦結果を cache に保存。
 * UNIQUE 制約衝突（同 key が並行 insert された場合）は silent に無視。
 */
export async function insertCache(
  cacheKey: string,
  answers: WizardAnswers,
  recommendations: Recommendation[],
  model: string,
): Promise<void> {
  const { error } = await supabase
    .from('ai_recommendations')
    .insert({
      cache_key:       cacheKey,
      destination:     answers.destination,
      max_minutes:     answers.maxMinutes,
      rent_max:        answers.rentMax,
      household:       answers.household,
      atmosphere:      answers.atmosphere,
      safety:          answers.safety,
      recommendations: recommendations,
      ai_model:        model,
    })

  if (error) {
    // 23505 = unique_violation（並行 insert 衝突）— 無視で OK
    if (error.code === '23505') return
    console.warn('[cache] insert error (recommendations still served):', error.message)
  }
}
