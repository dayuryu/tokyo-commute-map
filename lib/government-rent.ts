/**
 * 政府住宅統計家賃データ (Phase 2 baseline)
 *
 * - 出典: 総務省統計局「住宅・土地統計調査」(令和5年=2023年)
 * - 統計表 0004021452「居住室の畳数(6区分)別住宅の１か月当たり家賃(借家)」
 * - 抽出条件: 畳数総数 × 家賃０円除外（民間賃貸ベース、社宅・公営除く）
 * - 全関東駅 2043 のうち 1940 (95%) にマッピング、残り 5% は人口 1.5 万人未満の
 *   小町村で e-Stat が公開していないため未収録
 * - 単位: 円（÷10000 で 万円表示）
 *
 * SUUMO 101 駅データとの位置付け:
 *   - SUUMO: 新築・徒歩 5 分以内、相場上限寄り（× 0.9 で 10 分換算）
 *   - 政府: 全築年数・全立地、市区町村全体の平均
 *   両者は baseline が異なる。SUUMO がある駅は SUUMO 優先、無い駅は政府で fallback。
 */

export interface GovernmentRentMeta {
  source:        string
  parent_data:   string
  unit_raw:      string
  unit_display:  string
  station_count: number
  kanto_total:   number
  coverage:      string
  disclaimer:    string
}

export interface GovernmentRentData {
  _meta:    GovernmentRentMeta
  stations: Record<string, number>  // station_code (string) → 月家賃 (円)
}

/** station_code → 月家賃（円）の dict */
export type GovernmentRentMap = Record<string, number>

let inflight: Promise<GovernmentRentData | null> | null = null

/**
 * クライアント側で /data/station_government_rent.json を取得。
 * 失敗時は null。多重呼出しは inflight キャッシュで 1 回に集約。
 */
export async function loadGovernmentRentData(): Promise<GovernmentRentData | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/data/station_government_rent.json')
      if (!r.ok) return null
      return (await r.json()) as GovernmentRentData
    } catch {
      return null
    }
  })()
  return inflight
}

/**
 * 円 → 「地区平均 ○○ 万円」表示形式に変換。0.1 万円精度に丸める。
 * 例: 71147 → "地区平均 7.1 万円"
 * 「地区」を採用したのは市/区/町/村いずれでも自然なため。
 */
export function formatGovernmentRent(yen: number | undefined): string | null {
  if (!yen) return null
  const man = Math.round(yen / 1000) / 10
  return `地区平均 ${man} 万円`
}
