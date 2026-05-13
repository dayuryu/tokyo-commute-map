/**
 * AI 推薦の候補駅フィルタリング
 *
 * 1843 駅 → 通勤時間 + 家賃帯 + 通勤先指定で 100-200 駅に絞り込む。
 * 全 1843 駅を prompt に入れると context が膨らみ AI 推論精度も落ちるため、
 * 事前に「ユーザー条件に明らかに合う候補」のみ AI に渡す設計。
 */

import { loadServerStationData } from './data-loader'
import type { WizardAnswers, CandidateStation, RentMax, CommuteByCode } from './types'

/**
 * 居住性ブラックリスト — 純商業・行政区駅の station code
 *
 * 通勤時間 0-5 分で top にせり上がってくるが、SUUMO 等で物件がほぼ無く
 * 「居住候補」として推薦されると違和感が強い駅を AI 候補から除外する。
 * 皇居・霞が関・新橋一帯のオフィス街 13 駅。
 * 周辺の銀座・半蔵門・八丁堀等は住宅実態があるため対象外。
 */
const NON_RESIDENTIAL_STATION_CODES: ReadonlySet<number> = new Set([
  100201,   // 東京
  1130102,  // 新橋
  1130225,  // 有楽町
  2800113,  // 虎ノ門
  2800114,  // 溜池山王
  2800208,  // 大手町(東京)
  2800211,  // 霞ケ関（千代田区、東京メトロ）※「霞ヶ関」(埼玉県川越市・東武東上線) は別駅
  2800212,  // 国会議事堂前
  2800315,  // 日比谷
  2800511,  // 二重橋前
  2800616,  // 永田町
  2800617,  // 桜田門
  9930307,  // 内幸町
])

/**
 * 家賃帯マッピング（円、月家賃）
 * - SUUMO 5 分原データ × 0.9 倍率の 1R/1K 最低値、または政府データ
 * - 上限は band ぴったりではなく多少 buffer を取る
 */
const RENT_BANDS: Record<RentMax, { max: number }> = {
  '~7万':    { max: 75000   },   // 〜7 万予算層 → 7.5 万まで許容
  '7-10万':  { max: 110000  },   // 7-10 万予算層 → 11 万まで
  '10-15万': { max: 165000  },   // 10-15 万予算層 → 16.5 万まで
  '15万+':   { max: 9999999 },   // 上限無し
}

/**
 * SUUMO 5 分原データ × 0.9 = 徒歩 10 分以内目安、円換算で返す。
 * SUUMO 無ければ政府データの月家賃中央値を返す。両方無ければ null。
 */
function getStationRent(
  name: string,
  code: number,
  manualRent: Record<string, { '1R'?: number | null; '1K'?: number | null }>,
  governmentRent: Record<string, number>,
): { yen: number | null; source: 'suumo' | 'government' | null } {
  // Layer 1: SUUMO 1R/1K の最低値（5 分原 × 0.9）
  const m = manualRent[name]
  if (m) {
    const small = [m['1R'], m['1K']].filter((x): x is number => x != null)
    if (small.length > 0) {
      const minMan = Math.min(...small)
      return { yen: Math.round(minMan * 0.9 * 10000), source: 'suumo' }
    }
  }
  // Layer 2: 政府データ
  const g = governmentRent[String(code)]
  if (g != null) return { yen: g, source: 'government' }
  return { yen: null, source: null }
}

/**
 * Wizard 答えから候補駅 list を構築する。
 *
 * - 通勤時間 ≤ maxMinutes + 5（buffer）
 * - 家賃データある場合は band.max まで、無い場合は通す（除外しない）
 * - 通勤時間 → 家賃 の順でソート、top 150 のみ返す
 *
 * @param answers Wizard 答え
 * @param overrideCommute  destination === 'custom' の時に client が事前算出した
 *   通勤 map。存在する場合は geojson の `min_to_<slug>` 預計算ではなくこの map から
 *   通勤情報を引く。fixed destination の場合は undefined を渡す。
 */
export async function buildCandidates(
  answers: WizardAnswers,
  overrideCommute?: CommuteByCode,
): Promise<CandidateStation[]> {
  const data = await loadServerStationData()
  const { destination, maxMinutes, rentMax } = answers
  const band = RENT_BANDS[rentMax]

  const ranked: (CandidateStation & { _rentSort: number })[] = []

  for (const code in data.stations) {
    const s = data.stations[code]
    if (NON_RESIDENTIAL_STATION_CODES.has(s.code)) continue
    const commute = overrideCommute ? overrideCommute[s.code] : s.commute[destination]
    if (!commute) continue
    if (commute.min > maxMinutes + 5) continue   // 通勤時間 buffer 5 分

    const rent = getStationRent(s.name, s.code, data.manualRent, data.governmentRent)
    // 家賃 band フィルタ（rent 不明は通す = 政府データ無い小町村も候補に残す）
    if (rent.yen != null && rent.yen > band.max) continue

    ranked.push({
      name:        s.name,
      pref:        s.pref,
      min_to_dest: commute.min,
      transfers:   commute.transfers,
      rent_yen:    rent.yen,
      rent_source: rent.source,
      lines:       s.lines.slice(0, 3),
      _rentSort:   rent.yen ?? 999999,
    })
  }

  // 並び替え: 通勤時間 ↑、家賃 ↑
  ranked.sort((a, b) => {
    if (a.min_to_dest !== b.min_to_dest) return a.min_to_dest - b.min_to_dest
    return a._rentSort - b._rentSort
  })

  // top 150 のみ AI に渡す
  return ranked.slice(0, 150).map(({ _rentSort: _, ...rest }) => rest)
}
