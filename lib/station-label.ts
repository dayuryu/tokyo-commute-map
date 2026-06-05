/**
 * 駅名の locale 別表示ヘルパ。
 *
 * en locale ではローマ字（name_en / nameEn）を主表記にする。
 * ローマ字未生成の駅は日本語名に graceful fallback（ja / zh は常に日本語名）。
 */

type NamedStation = { name: string; nameEn?: string; name_en?: string }

function romaji(s: NamedStation): string | undefined {
  return s.nameEn ?? s.name_en
}

/** 狭い場所（pin / popup / リスト）用: en はローマ字のみ、他は日本語名。 */
export function stationLabel(s: NamedStation, locale: string): string {
  if (locale === 'en') return romaji(s) ?? s.name
  return s.name
}

/** Drawer 見出し用: en は「Shinjuku 新宿」の併記、他は日本語名のみ。 */
export function stationHeading(s: NamedStation, locale: string): string {
  if (locale === 'en') {
    const r = romaji(s)
    return r ? `${r} ${s.name}` : s.name
  }
  return s.name
}

/** 検索クエリ正規化: 小文字化 + 空白/ハイフン/ピリオド除去（romaji 入力向け）。 */
function normalize(q: string): string {
  return q.toLowerCase().replace(/[\s\-.]/g, '')
}

/**
 * 駅名検索の共通マッチャ。日本語の部分一致に加え、ローマ字（あれば）の
 * 正規化部分一致も常に許可する（locale 不問 — ja UI で romaji を打っても困らない）。
 */
export function stationMatches(s: NamedStation, query: string): boolean {
  if (!query) return false
  if (s.name.includes(query)) return true
  const r = romaji(s)
  if (!r) return false
  const nq = normalize(query)
  return nq.length > 0 && normalize(r).includes(nq)
}
