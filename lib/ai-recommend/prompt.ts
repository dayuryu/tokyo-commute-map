/**
 * OpenAI 推薦用の prompt template
 *
 * 6 項目の Wizard 答え + 候補駅 list から system + user message を組み立てる。
 * GPT-5.4 nano は structured outputs（JSON schema）で安定して 20 駅推薦を返す。
 */

import type { WizardAnswers, CandidateStation } from './types'

const SYSTEM_PROMPT = `あなたは東京圏の住宅エリア推薦アシスタント。ユーザーは多様な層（日本人・在日外国人・海外から日本移住を検討中の人など）、ユーザーの 6 項目の希望と候補駅 list から 20 駅を選んで日本語で推薦理由を返す。多言語化を将来予定しているため、特定民族・文化圏向けの表現は避け、誰にでも通じるニュートラルな書き方をする。

# 出力ルール
- 必ず JSON object、\`recommendations\` 配列に厳密に 20 件
- 各要素: \`{ "station_name": "...", "reason": "..." }\`
- **station_name は候補 list の各行で「」で囲まれた駅名のみ**（例：「中野(東京)」「阿佐ケ谷」）
- **絶対に都道府県名や路線名や家賃情報を station_name に含めないこと**
  - ❌ NG: "中野(東京) (東京都)" / "中野(東京) | 通勤5分"
  - ✅ OK: "中野(東京)"
- reason は 1-2 文、80 文字以内、editorial 調
- 固有施設名（特定の店・ライブハウス・会社名）の幻覚は絶対禁止。一般論で書く

# 選定方針
1. 通勤先・通勤時間・家賃帯は事前フィルタ済み、候補 list 内全てが条件 OK
2. ユーザーの「家族構成・街の雰囲気・治安重視度」の希望に最も合う 20 駅を選ぶ
3. バラエティ重視: 同沿線・同地区で固まり過ぎない、地理的に分散させる
4. 上位 5 駅は希望に最もよく合うもの、下位 15 駅で多様性確保

# 推薦理由の書き方の例
- ✅「東横線沿線、落ち着いた住宅街。商店街徒歩圏で利便性高め、単身〜カップル向け。」
- ✅「JR京浜東北線、神奈川県北部の庶民派。家賃 9 万円台、ファミリー層多く治安良好。」
- ❌「下北沢には ABC ライブハウスが…」（固有施設名幻覚）
- ❌「素晴らしい街で皆さんに大人気！」（宣伝口調）`

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

/**
 * Wizard 答えと候補駅 list から user message を組み立てる。
 */
export function buildUserPrompt(answers: WizardAnswers, candidates: CandidateStation[]): string {
  const destLabel = answers.destination === 'custom' ? 'カスタム指定駅' : answers.destination

  // 候補 list を 1 行ずつのコンパクト形式で。
  // 駅名は「」で囲んで AI が station_name に他の情報を混ぜないようにする。
  const candidateLines = candidates.map(c => {
    const rentText = c.rent_yen != null
      ? `家賃約 ${(c.rent_yen / 10000).toFixed(1)} 万`
      : '家賃データ無'
    const lines = c.lines.length > 0 ? c.lines.join('・') : '路線データ無'
    return `- 「${c.name}」 / ${c.pref} / 通勤 ${c.min_to_dest} 分・乗換 ${c.transfers} 回 / ${rentText} / ${lines}`
  }).join('\n')

  return `# ユーザー希望

通勤先:       ${destLabel}
通勤時間上限: ${answers.maxMinutes} 分
家賃上限:     ${answers.rentMax}
家族構成:     ${answers.household}
街の雰囲気:   ${answers.atmosphere}
治安重視度:   ${answers.safety}

# 候補駅 list（${candidates.length} 件、通勤時間・家賃フィルタ済み）

${candidateLines}

# タスク

上記候補から 20 駅を選び、ユーザーの「家族構成・街の雰囲気・治安重視度」の希望に基づく推薦理由（1-2 文、80 字以内、editorial 調、固有施設名禁止）を付けて JSON で返してください。`
}

/**
 * OpenAI structured outputs 用の JSON schema。
 * minItems/maxItems を 20 に固定、駅名と理由のみ。
 */
export const RECOMMENDATIONS_JSON_SCHEMA = {
  name: 'station_recommendations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            station_name: { type: 'string' },
            reason:       { type: 'string' },
          },
          required: ['station_name', 'reason'],
        },
      },
    },
    required: ['recommendations'],
  },
} as const
