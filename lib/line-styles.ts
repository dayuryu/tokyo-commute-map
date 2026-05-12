/**
 * 路線スタイル（色 + symbol）の facade。
 *
 * - 出典: station_database/out/main/line/*.json
 * - 生成スクリプト: scripts/build_line_styles.py
 * - 出力先: public/data/line_styles.json
 *
 * 用途: StationDrawer の「主要路線」DetailRow に方案 D（色条 + 路線名）を描画する際、
 * 駅 properties の line_names 配列から名前を取り、本ファイルが提供する map で color を引く。
 */

export interface LineStyle {
  color:  string | null
  symbol: string | null
}

export type LineStyleMap = Record<string, LineStyle>

let inflight: Promise<LineStyleMap | null> | null = null

/**
 * 路線スタイル map をクライアントで取得。失敗時は null。
 * 多重呼出しは inflight キャッシュで 1 回に集約。
 */
export async function loadLineStyles(): Promise<LineStyleMap | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/data/line_styles.json')
      if (!r.ok) return null
      return (await r.json()) as LineStyleMap
    } catch {
      return null
    }
  })()
  return inflight
}

/**
 * 不明な路線・色なし路線用のフォールバック色（ink-mute 相当）。
 */
export const FALLBACK_LINE_COLOR = '#908a7c'

/**
 * 路線名から代表色を取得（map がまだ load 済みでなくても safe）。
 */
export function getLineColor(name: string, map: LineStyleMap): string {
  return map[name]?.color || FALLBACK_LINE_COLOR
}
