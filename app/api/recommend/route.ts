/**
 * POST /api/recommend
 *
 * AI 駅推薦の主 endpoint。Wizard 答えを受け取り 20 駅推薦を返す。
 *
 * Request body: RecommendRequest = WizardAnswers + deviceId
 * Response:     RecommendApiResponse
 *
 * 内部フロー:
 *   1. 入力 validate（deviceId 必須）
 *   2. IP 抽出 + SHA-256 hash（生 IP は記録しない）
 *   3. cache lookup（custom destination 以外）
 *      - 命中 → recordUsage(cache_hit=true) + return
 *   4. buildCandidates で 1843 駅 → top 150 候補
 *   5. 候補 < 20 → fallback 即返（AI 呼ばない）
 *   6. **Rate limit チェック**（cache miss + AI 真調用の前で）
 *      - 超過 → 429 + 友好メッセージ
 *   7. OpenAI 呼び出し → recordUsage(cache_hit=false) + insertCache + return
 *   8. 失敗時は fallback で返す（壊れない）
 */

import { NextResponse } from 'next/server'
import type { RecommendRequest, WizardAnswers, RecommendApiResponse } from '@/lib/ai-recommend/types'
import { buildCandidates } from '@/lib/ai-recommend/candidates'
import { callRecommend, buildFallback, MODEL } from '@/lib/ai-recommend/openai'
import { buildCacheKey, isCacheable, lookupCache, insertCache } from '@/lib/ai-recommend/cache'
import { checkRateLimit, recordUsage, extractIp, hashIp } from '@/lib/ai-recommend/rate-limit'

const VALID_MINUTES    = [30, 45, 60, 90]
const VALID_RENT       = ['~7万', '7-10万', '10-15万', '15万+']
const VALID_HOUSEHOLD  = ['単身', 'カップル', '子持ち']
const VALID_ATMOSPHERE = ['賑やか', '落ち着いた', '緑が多い', '商業集中']
const VALID_SAFETY     = ['最重要', '普通', '気にしない']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validate(input: any): input is RecommendRequest {
  return (
    input != null &&
    typeof input.deviceId === 'string' && input.deviceId.length > 0 &&
    typeof input.destination === 'string' && input.destination.length > 0 &&
    VALID_MINUTES.includes(input.maxMinutes) &&
    VALID_RENT.includes(input.rentMax) &&
    VALID_HOUSEHOLD.includes(input.household) &&
    VALID_ATMOSPHERE.includes(input.atmosphere) &&
    VALID_SAFETY.includes(input.safety)
  )
}

function jsonRes(body: RecommendApiResponse, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: extraHeaders })
}

export async function POST(req: Request) {
  // ── Step 1: body parse ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonRes({ ok: false, error: 'invalid JSON body' }, 400)
  }

  // ── Step 2: validate ────────────────────────────────────────
  if (!validate(body)) {
    return jsonRes({ ok: false, error: 'invalid input fields' }, 400)
  }
  const { deviceId, ...answersFields } = body as RecommendRequest
  const answers = answersFields as WizardAnswers

  // ── Step 3: extract IP & hash（生 IP は保存しない） ──────────
  const ipRaw = extractIp(req)
  const ipHashed = ipRaw !== 'unknown' ? hashIp(ipRaw) : ''

  // ── Step 4: cache lookup（custom destination はスキップ） ───
  let cacheKey: string | null = null
  if (isCacheable(answers)) {
    cacheKey = buildCacheKey(answers)
    const cached = await lookupCache(cacheKey)
    if (cached && cached.length > 0) {
      // cache hit は rate limit 対象外、ただし統計用に usage 記録
      void recordUsage(deviceId, ipHashed, answers.destination, true)
      return jsonRes({
        ok: true,
        recommendations: cached,
        count: cached.length,
        cached: true,
      })
    }
  }

  // ── Step 5: build candidates ────────────────────────────────
  let candidates
  try {
    candidates = await buildCandidates(answers)
  } catch (e) {
    console.error('[/api/recommend] buildCandidates failed:', e)
    return jsonRes({ ok: false, error: 'internal data load error' }, 500)
  }

  if (candidates.length === 0) {
    return jsonRes({
      ok: false,
      error: '条件を満たす駅が見つかりません。通勤時間か家賃の条件を緩めてみてください。',
    })
  }

  // 候補 < 20 → AI を呼ばずに fallback で直接返す（コスト + 安定性）
  // 注: AI 呼ばないので rate limit 対象外
  if (candidates.length < 20) {
    void recordUsage(deviceId, ipHashed, answers.destination, true)  // 真調用扱いではない
    const recs = buildFallback(candidates)
    return jsonRes({
      ok: true,
      recommendations: recs,
      count: recs.length,
      fallback: true,
    })
  }

  // ── Step 6: Rate limit チェック（cache miss + 真調用の前で）──
  const limit = await checkRateLimit(deviceId, ipHashed)
  if (!limit.allowed) {
    console.log(`[/api/recommend] rate limit hit: ${limit.reason} (device=${deviceId.slice(0, 8)}...)`)
    return jsonRes(
      { ok: false, error: limit.message ?? '利用上限に達しました' },
      429,
      limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : undefined,
    )
  }

  // ── Step 7: AI 呼び出し ─────────────────────────────────────
  try {
    const recs = await callRecommend(answers, candidates)
    if (recs.length === 0) {
      throw new Error('AI returned zero valid recommendations after filter')
    }
    // cache 書き込み + usage 記録（cache_hit=false = 真調用カウント）
    if (cacheKey) {
      void insertCache(cacheKey, answers, recs, MODEL)
    }
    void recordUsage(deviceId, ipHashed, answers.destination, false)
    return jsonRes({
      ok: true,
      recommendations: recs,
      count: recs.length,
    })
  } catch (e) {
    console.error('[/api/recommend] OpenAI failed, using fallback:', e)
    void recordUsage(deviceId, ipHashed, answers.destination, false)  // 真調用試行扱い
    const recs = buildFallback(candidates)
    return jsonRes({
      ok: true,
      recommendations: recs,
      count: recs.length,
      fallback: true,
    })
  }
}
