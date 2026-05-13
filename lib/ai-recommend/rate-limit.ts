/**
 * AI 推薦 endpoint の rate limit 制御
 *
 * 4 層チェック:
 *   1. Device daily   — 同 device_id が過去 24h で OpenAI 真調用が 5 回以上
 *   2. Device burst   — 同 device_id が過去 60 秒で 3 回以上
 *   3. IP minute      — 同 IP_hash が過去 60 秒で 10 回以上
 *   4. Global daily   — サイト全体で過去 24h で OpenAI 真調用が 300 回以上
 *
 * **重要**: cache_hit=true（キャッシュ命中）は rate limit カウント対象外。
 * 同じ条件を何度クエリしても OpenAI を呼ばないので、ユーザーに制限する理由が無い。
 *
 * IP は SHA-256 でハッシュして保存（生 IP 保存しない、隐私 / GDPR 配慮）。
 */

import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

// ── 平衡型阈値（主人 2026-05-13 確定） ──────────────────────
export const DEVICE_DAILY_LIMIT = 5    // 1 device、24h で OpenAI 真調用 5 回
export const DEVICE_BURST_LIMIT = 3    // 1 device、60sec で 3 回
export const IP_MINUTE_LIMIT    = 10   // 1 IP、60sec で 10 回
export const GLOBAL_DAILY_LIMIT = 300  // 全体、24h で OpenAI 真調用 300 回

export type RateLimitReason =
  | 'device_daily'
  | 'device_burst'
  | 'ip_minute'
  | 'global_daily'

export interface RateLimitResult {
  allowed: boolean
  reason?:  RateLimitReason
  message?: string      // user 向け日本語メッセージ
  retryAfter?: number   // 秒（HTTP 429 Retry-After 用）
}

/** IP を SHA-256 でハッシュ（生 IP は保存しない） */
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

/**
 * Request から client IP を抽出。
 * Vercel: x-forwarded-for（最初の項）/ x-real-ip / fallback 'unknown'
 */
export function extractIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/**
 * Cache miss の時のみ呼ぶ。4 層チェック、最初に引っかかった層で reject。
 * Supabase クエリは 4 回（独立）、並列化はせず順次（最初の miss で短絡）。
 */
export async function checkRateLimit(
  deviceId: string,
  ipHash: string,
): Promise<RateLimitResult> {
  const now = Date.now()
  const oneMinAgoISO = new Date(now - 60 * 1000).toISOString()
  const oneDayAgoISO = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // 共通: cache_hit=false（真調用のみ）でカウント
  const ofMiss = () => supabase
    .from('ai_recommend_usage')
    .select('id', { count: 'exact', head: true })
    .eq('cache_hit', false)

  // ── 1. Device daily ──────────────────────────────────────
  const dDaily = await ofMiss()
    .eq('device_id', deviceId)
    .gte('requested_at', oneDayAgoISO)
  if (!dDaily.error && (dDaily.count ?? 0) >= DEVICE_DAILY_LIMIT) {
    return {
      allowed: false,
      reason:  'device_daily',
      message: `本日の AI 推薦利用上限（${DEVICE_DAILY_LIMIT} 回）に達しました。明日再度お試しください。同じ条件であればキャッシュからすぐ結果が出ます。`,
      retryAfter: 60 * 60,  // 1h で再試行案内（実際は明日まで）
    }
  }

  // ── 2. Device burst ──────────────────────────────────────
  const dBurst = await ofMiss()
    .eq('device_id', deviceId)
    .gte('requested_at', oneMinAgoISO)
  if (!dBurst.error && (dBurst.count ?? 0) >= DEVICE_BURST_LIMIT) {
    return {
      allowed: false,
      reason:  'device_burst',
      message: '少しお待ちください（短時間に連続でリクエストできません）。',
      retryAfter: 60,
    }
  }

  // ── 3. IP minute（IP 不明な場合スキップ） ──────────────
  if (ipHash) {
    const ipMin = await ofMiss()
      .eq('ip_hash', ipHash)
      .gte('requested_at', oneMinAgoISO)
    if (!ipMin.error && (ipMin.count ?? 0) >= IP_MINUTE_LIMIT) {
      return {
        allowed: false,
        reason:  'ip_minute',
        message: '少しお待ちください（同一ネットワークからのアクセスが集中しています）。',
        retryAfter: 60,
      }
    }
  }

  // ── 4. Global daily ──────────────────────────────────────
  const gDaily = await ofMiss()
    .gte('requested_at', oneDayAgoISO)
  if (!gDaily.error && (gDaily.count ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return {
      allowed: false,
      reason:  'global_daily',
      message: '本日のサイト全体の AI 推薦利用上限に達しました。同じ条件であればキャッシュから結果が返ります。明日になれば再度お試しいただけます。',
      retryAfter: 60 * 60,
    }
  }

  return { allowed: true }
}

/**
 * usage 記録（cache hit / miss 両方記録、統計用）。
 * Insert は silent fail、機能に影響させない。
 */
export async function recordUsage(
  deviceId: string,
  ipHash: string,
  destination: string,
  cacheHit: boolean,
): Promise<void> {
  const { error } = await supabase.from('ai_recommend_usage').insert({
    device_id:   deviceId,
    ip_hash:     ipHash || null,
    destination,
    cache_hit:   cacheHit,
  })
  if (error) console.warn('[rate-limit] usage insert error:', error.message)
}
