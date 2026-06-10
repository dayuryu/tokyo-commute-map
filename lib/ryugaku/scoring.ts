// 算分引擎 + URL 编解码（纯前端，无后端）
import {
  AXES,
  AXIS_ORDER,
  QUESTIONS,
  BONUS_QUESTIONS,
  PERSONA_BY_CODE,
  HIDDEN_PERSONAS,
} from './quiz-data'
import type { AxisScores, Likert, QuizResult } from './types'

/** 所有题（主轴 + 彩蛋）按固定顺序，URL 编码依赖此序 */
const ALL_QUESTION_IDS: string[] = [
  ...QUESTIONS.map(q => q.id),
  ...BONUS_QUESTIONS.map(q => q.id),
]

/** 主轴每轴 5 题，单轴最大绝对分 = 5 × 2 = 10 */
const AXIS_MAX = 10

type Answers = Record<string, Likert>

// ── 主轴累计分 ───────────────────────────────────────────
function rawAxisScores(answers: Answers): AxisScores {
  const acc: AxisScores = { budget: 0, community: 0, goal: 0, geo: 0 }
  for (const q of QUESTIONS) {
    const v = answers[q.id] ?? 0
    acc[q.axis] += v * q.direction
  }
  return acc
}

/** 四轴归一化到 -1..1（雷达图用） */
function normalize(raw: AxisScores): AxisScores {
  const out = {} as AxisScores
  for (const k of AXIS_ORDER) {
    out[k] = Math.max(-1, Math.min(1, raw[k] / AXIS_MAX))
  }
  return out
}

/** 四轴正负 → 4 字母 code（顺序 budget·community·goal·geo） */
function resolveCode(raw: AxisScores): string {
  return AXIS_ORDER.map(key => {
    const axis = AXES.find(a => a.key === key)!
    // >= 0 取正分极字母（含 0 时偏正极，避免空 code）
    return raw[key] >= 0 ? axis.pos.letter : axis.neg.letter
  }).join('')
}

// ── 隐藏型触发 ───────────────────────────────────────────
// 条件 = 对应彩蛋题高分 + 主轴极值。多个命中取信号最强（彩蛋题分最高）。
type HiddenHit = { key: keyof typeof HIDDEN_PERSONAS; strength: number }

function resolveHidden(answers: Answers, raw: AxisScores) {
  const hits: HiddenHit[] = []
  const x1 = answers.x1 ?? 0 // 为爱发电
  const x2 = answers.x2 ?? 0 // 打工优先
  const x3 = answers.x3 ?? 0 // 家里给钱
  const x4 = answers.x4 ?? 0 // 学历含糊

  // 港区のセレブ：家里给钱 + 有钱(L) + 不为学历
  if (x3 >= 1 && raw.budget <= -4 && raw.goal <= 0) hits.push({ key: 'serebu', strength: x3 })
  // 圣地巡礼者：为爱发电(非常同意) + 强追梦
  if (x1 >= 2 && raw.goal <= -2) hits.push({ key: 'pilgrim', strength: x1 })
  // 出稼ぎ战士：打工优先 + 省钱(P) + 远郊倾向
  if (x2 >= 1 && raw.budget >= 4 && raw.geo <= 0) hits.push({ key: 'dekasegi', strength: x2 })
  // 福祉大幸存者：学历含糊 + 省钱(P)
  if (x4 >= 1 && raw.budget >= 4) hits.push({ key: 'fukushi', strength: x4 })

  if (hits.length === 0) return null
  hits.sort((a, b) => b.strength - a.strength)
  return HIDDEN_PERSONAS[hits[0].key]
}

// ── 主入口 ───────────────────────────────────────────────
export function computeResult(answers: Answers): QuizResult {
  const raw = rawAxisScores(answers)
  const code = resolveCode(raw)
  const persona = PERSONA_BY_CODE[code]
  const hidden = resolveHidden(answers, raw)
  return { code, persona, hidden, axes: normalize(raw) }
}

// ── URL 编解码（分享还原；不含个人信息）────────────────────
// 每题 1 字符 '0'..'4'（= likert -2..2 + 2），按 ALL_QUESTION_IDS 顺序。
const ENC_VERSION = '1'

export function encodeAnswers(answers: Answers): string {
  const body = ALL_QUESTION_IDS.map(id => {
    const v = answers[id] ?? 0
    return String(Math.max(0, Math.min(4, v + 2)))
  }).join('')
  return ENC_VERSION + body
}

export function decodeAnswers(code: string): Answers | null {
  if (!code || code[0] !== ENC_VERSION) return null
  const body = code.slice(1)
  if (body.length !== ALL_QUESTION_IDS.length) return null
  const answers: Answers = {}
  for (let i = 0; i < ALL_QUESTION_IDS.length; i++) {
    const n = body.charCodeAt(i) - 48 // '0' = 48
    if (n < 0 || n > 4) return null
    answers[ALL_QUESTION_IDS[i]] = (n - 2) as Likert
  }
  return answers
}

/** 本命车站显示名（含隐藏型优先），结果页展示用 */
export function resultStations(result: QuizResult): string[] {
  return result.hidden ? result.hidden.stations : result.persona.stations
}

/** 本命车站 geojson 正规名（含消歧后缀），地图 ?rstations= 高亮用 */
export function resultStationKeys(result: QuizResult): string[] {
  return result.hidden ? result.hidden.stationKeys : result.persona.stationKeys
}

/** 结果展示用：型名 + 日文副句 + slogan + 代表色（隐藏型优先） */
export function resultFace(result: QuizResult): {
  name: string
  nameJa: string
  slogan: string
  color: string
  code: string
  isHidden: boolean
} {
  const p = result.hidden ?? result.persona
  return {
    name: p.name,
    nameJa: p.nameJa,
    slogan: p.slogan,
    color: p.color,
    code: result.code,
    isHidden: result.hidden !== null,
  }
}

export { ALL_QUESTION_IDS }
export type { Answers }
