/**
 * OpenAI (gpt-5.4-nano) 呼び出しラッパー
 *
 * - structured outputs (JSON schema strict mode) で 20 駅推薦を取得
 * - 候補 list 内の駅名のみフィルタ通過（幻覚対策）
 * - 失敗時は throw、Route Handler 側で fallback 担当
 *
 * GPT-5 系列以降、`max_tokens` は `max_completion_tokens` に rename されている。
 */

import OpenAI from 'openai'
import type { WizardAnswers, CandidateStation, Recommendation } from './types'
import { buildSystemPrompt, buildUserPrompt, RECOMMENDATIONS_JSON_SCHEMA } from './prompt'

export const MODEL = 'gpt-5.4-nano'
const MAX_COMPLETION_TOKENS = 4000   // 20 駅 × ~80 字 ≈ 3500 token、buffer 込み 4000

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY が .env.local に設定されていません')
    client = new OpenAI({ apiKey })
  }
  return client
}

/**
 * OpenAI に 20 駅推薦を依頼。
 *
 * @returns 候補 list 内の駅名のみフィルタ済みの Recommendation[]
 * @throws OpenAI API エラー、JSON parse 失敗、空 content など
 */
export async function callRecommend(
  answers: WizardAnswers,
  candidates: CandidateStation[],
): Promise<Recommendation[]> {
  const validNames = new Set(candidates.map(c => c.name))

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: buildUserPrompt(answers, candidates) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: RECOMMENDATIONS_JSON_SCHEMA,
    },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')

  let parsed: { recommendations: Recommendation[] }
  try {
    parsed = JSON.parse(content) as { recommendations: Recommendation[] }
  } catch (e) {
    throw new Error(`OpenAI returned invalid JSON: ${String(e)}`)
  }

  if (!parsed || !Array.isArray(parsed.recommendations)) {
    throw new Error('OpenAI response missing `recommendations` array')
  }

  // 幻覚 filter: 候補 list 内の駅名のみ通す
  const filtered = parsed.recommendations
    .filter(r => r && typeof r.station_name === 'string' && validNames.has(r.station_name))
    // 同じ駅が複数回来た場合は最初の 1 件のみ採用
    .reduce<Recommendation[]>((acc, r) => {
      if (!acc.some(x => x.station_name === r.station_name)) acc.push(r)
      return acc
    }, [])

  // 観測用 1 行 log（filter で落とした数を運用時に把握）
  if (filtered.length < parsed.recommendations.length) {
    console.log(`[ai-recommend] filtered ${parsed.recommendations.length - filtered.length}/${parsed.recommendations.length} invalid names`)
  }

  return filtered
}

/**
 * AI 失敗時の fallback: 候補 list 先頭 20 駅を generic reason で返す。
 * Route Handler が catch 時に呼ぶ想定。
 */
export function buildFallback(candidates: CandidateStation[]): Recommendation[] {
  return candidates.slice(0, 20).map(c => {
    const rentText = c.rent_yen != null
      ? `家賃約 ${(c.rent_yen / 10000).toFixed(1)} 万`
      : '家賃データ無'
    const lines = c.lines.length > 0 ? c.lines.slice(0, 2).join('・') : '路線データ無'
    return {
      station_name: c.name,
      reason: `${c.pref}、通勤 ${c.min_to_dest} 分・乗換 ${c.transfers} 回。${lines}。${rentText}。`,
    }
  })
}
