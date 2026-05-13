/**
 * AI 駅推薦機能の型定義
 *
 * 6 問の Wizard 答え → OpenAI (gpt-5.4-nano) → 20 駅推薦
 * docs/ai-advisor-plan.md の仕様に基づく。
 */

// ── 6 問の選択肢 ──────────────────────────────────────────────

/** 通勤先 — 30 fixed destinations の slug（destinations.ts と同期）or 'custom' */
export type CommuteDestination = string

/** 通勤時間の上限（分） */
export type CommuteMaxMinutes = 30 | 45 | 60 | 90

/** 家賃上限の区分 */
export type RentMax = '~7万' | '7-10万' | '10-15万' | '15万+'

/** 家族構成 */
export type Household = '単身' | 'カップル' | '子持ち'

/** 街の雰囲気の希望 */
export type Atmosphere = '賑やか' | '落ち着いた' | '緑が多い' | '商業集中'

/** 治安重視度 */
export type SafetyPriority = '最重要' | '普通' | '気にしない'

/** Wizard 答え一式 */
export interface WizardAnswers {
  destination: CommuteDestination
  maxMinutes:  CommuteMaxMinutes
  rentMax:     RentMax
  household:   Household
  atmosphere:  Atmosphere
  safety:      SafetyPriority
}

/** /api/recommend POST のリクエスト body */
export interface RecommendRequest extends WizardAnswers {
  /** クライアント localStorage の UUID、rate limit / 利用統計に使用 */
  deviceId: string
}

// ── OpenAI 出力 ──────────────────────────────────────────────

/** 1 駅の推薦 */
export interface Recommendation {
  /** 駅名（必ず stations.geojson の name と完全一致） */
  station_name: string
  /** 推薦理由 1-2 文、日本語、maxLength 120 */
  reason: string
}

/** OpenAI structured outputs で受け取る完全な response */
export interface RecommendationsPayload {
  recommendations: Recommendation[]
}

// ── API Route の response ──────────────────────────────────────

/** /api/recommend POST の成功レスポンス */
export interface RecommendSuccess {
  ok: true
  recommendations: Recommendation[]
  /** valid な駅名のみフィルタした結果、20 未満になった場合の actual count */
  count: number
  /** OpenAI が失敗して fallback（30 destinations の上位 20）を返した時 true */
  fallback?: boolean
  /** Supabase ai_recommendations キャッシュから取得した場合 true（OpenAI 呼び出し節約） */
  cached?: boolean
}

/** /api/recommend POST の失敗レスポンス */
export interface RecommendFailure {
  ok: false
  error: string
}

export type RecommendApiResponse = RecommendSuccess | RecommendFailure

// ── 候補駅情報（prompt 用） ──────────────────────────────────

/** OpenAI に候補として渡す駅情報の最小 unit */
export interface CandidateStation {
  name:           string
  pref:           string  // 「東京都」「神奈川県」等
  min_to_dest:    number  // 通勤先までの分
  transfers:      number  // 乗換回数
  rent_yen?:      number | null  // 政府データ / SUUMO 由来の月家賃
  rent_source?:   'suumo' | 'government' | null
  lines:          string[]  // 主要路線 3 つまで
}
