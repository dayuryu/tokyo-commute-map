// lib/buckets.ts
// 通勤時間を maxMinutes に応じて動的に bucket 分けする共有ユーティリティ。
// MapView の散点配色 / cluster 配色 / Legend ラベルが同じ閾値を使うように、
// 1 ヶ所に集約。

// Editorial warm scale — 浮世絵風 forest → vermilion → oxblood
export const BUCKET_COLORS = [
  '#3a5226',  // 0  deep forest
  '#7d8a3f',  // 1  olive
  '#bba23e',  // 2  mustard
  '#c47835',  // 3  ochre
  '#a8332b',  // 4  vermilion
  '#6b1f18',  // 5  oxblood
] as const

/**
 * 通勤分数の 5 分刻み模糊化（v3.4 の表示方針）。
 * StationDrawer / FavoritesPanel が同じ丸めを共有する。
 * - n <= 0 は destination 自身（自分への通勤時間）→ 0 のまま
 * - 0 < n は最低 5 分に切り上げ（神泉 → 渋谷 raw 1-2 分が「0 分」になる bug 回避）
 */
export function round5(n: number): number {
  if (n <= 0) return 0
  return Math.max(5, Math.round(n / 5) * 5)
}

/**
 * maxMinutes に応じて、0..maxMinutes をいくつかの bucket に分割する閾値配列を返す。
 * - maxMinutes <= 15: 3 bucket（5 分刻み）→ thresholds = [5, 10]
 * - maxMinutes > 15:  6 bucket（均等割り）→ thresholds = [m/6, 2m/6, ..., 5m/6]
 *
 * 戻り値の閾値は整数 round（Legend の表示が崩れないように）。
 * bucket 数 = thresholds.length + 1
 * 各 bucket の色は BUCKET_COLORS[i] を使う（0..thresholds.length）。
 */
export function getBucketThresholds(maxMinutes: number): number[] {
  if (maxMinutes <= 15) return [5, 10]
  const step = maxMinutes / 6
  return [1, 2, 3, 4, 5].map(i => Math.round(i * step))
}

/**
 * 通勤分数を bucket index に変換。
 */
export function bucketize(minutes: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (minutes < thresholds[i]) return i
  }
  return thresholds.length
}

/**
 * Legend で表示する bucket 範囲ラベル。
 * 例: thresholds=[5,10] → ["< 5分","5–10","10+"]
 *     thresholds=[15,30,45,60,75] → ["< 15分","15–30","30–45","45–60","60–75","> 75"]
 *
 * unit は locale 依存（ja/zh: "分"、en: " min"）。呼び出し側が
 * legend.minuteUnit の翻訳値を渡す。既定は従来挙動の "分"。
 */
export function getBucketLabels(thresholds: number[], unit: string = '分'): string[] {
  if (thresholds.length === 0) return ['全範囲']
  const labels: string[] = []
  labels.push(`< ${thresholds[0]}${unit}`)
  for (let i = 1; i < thresholds.length; i++) {
    labels.push(`${thresholds[i - 1]}–${thresholds[i]}`)
  }
  labels.push(`> ${thresholds[thresholds.length - 1]}`)
  return labels
}
