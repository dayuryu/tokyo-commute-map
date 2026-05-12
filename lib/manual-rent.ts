/**
 * 手動収録家賃データ（101 駅、SUUMO 駅別相場ページから本小姐が目視取得）
 *
 * - 出典: https://suumo.jp/chintai/soba/<pref>/ek_<ek_id>/
 * - 生データ条件: 新築マンション、駅徒歩 1〜5 分以内（SUUMO 独自集計、相場の上限寄り）
 * - UI 表示条件: 徒歩 10 分以内目安（生データ × walk_factor=0.9 で推算）
 *   不動産業界共識として徒歩 10 分以内の相場は 5 分以内より約 8-12% 低い
 * - 全 1843 駅のうち通勤先 30 駅 + 住宅地 71 駅 を収録、残りは政府住宅統計 baseline で
 *   別途実装予定（docs/rent-data-plan.md 参照）
 *
 * 換算戦略: JSON 内には SUUMO の生データ（5 分）を保持、formatter で × walk_factor。
 * Phase 2 で政府データが入った時に walk_factor を校正できるよう疎結合に保つ。
 */

export interface RentRow {
  '1R':   number | null
  '1K':   number | null
  '1DK':  number | null
  '1LDK': number | null
  '2LDK': number | null
  '3LDK': number | null
  category?: 'office' | 'residential'  // 通勤先か住宅地か（収録分類用、UI 表示には未使用）
}

export interface ManualRentMeta {
  source:                string
  fetched_at:            string
  data_base_date:        string
  raw_conditions:        string
  ui_conditions:         string
  walk_factor:           number
  walk_factor_rationale: string
  unit:                  string
  disclaimer:            string
  station_count?:        number
  categories?:           Record<string, string>
  note_1k_tokyo_outlier?: string
}

export interface ManualRentData {
  _meta:    ManualRentMeta
  stations: Record<string, RentRow>
}

/** 駅名 → 家賃相場 dict。 */
export type RentMap = Record<string, RentRow>

let inflight: Promise<ManualRentData | null> | null = null

/** walk_factor のキャッシュ。loadManualRentData() 経由で _meta から上書きされる。 */
let walkFactorCache = 0.9

/**
 * クライアント側で /data/manual_rent_data.json を取得。
 * 失敗時は null を返し、UI 側は「未収録」表示にフォールバック。
 * 多重呼出しは inflight キャッシュで 1 回に集約。
 */
export async function loadManualRentData(): Promise<ManualRentData | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/data/manual_rent_data.json')
      if (!r.ok) return null
      const data = (await r.json()) as ManualRentData
      if (typeof data?._meta?.walk_factor === 'number') {
        walkFactorCache = data._meta.walk_factor
      }
      return data
    } catch {
      return null
    }
  })()
  return inflight
}

/** 生データに walk_factor を適用し 0.1 万円単位に丸める。 */
function applyFactor(v: number): number {
  return Math.round(v * walkFactorCache * 10) / 10
}

/**
 * 単身向け（1R/1K の最低値）を「○○ 万円〜」形式で返す。
 * 徒歩 10 分以内目安への換算済み。データなしは null。
 */
export function getSingleRentLabel(row: RentRow | undefined): string | null {
  if (!row) return null
  const small = [row['1R'], row['1K']].filter((x): x is number => x != null)
  if (small.length === 0) return null
  const min = Math.min(...small)
  return `${applyFactor(min)} 万円〜`
}

/**
 * カップル/ファミリー向け（1LDK の値）を返す。
 * 徒歩 10 分以内目安への換算済み。データなしは null。
 */
export function getCoupleRentLabel(row: RentRow | undefined): string | null {
  if (!row) return null
  const v = row['1LDK']
  return v != null ? `${applyFactor(v)} 万円` : null
}
