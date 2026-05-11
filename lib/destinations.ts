/**
 * 通勤・通学目的地の集中管理 facade。
 *
 * - `DESTINATIONS_META`: 30 個の正規目的地（オフィス・大学街集中度ベース）
 * - 各 entry: slug（geojson の min_to_<slug> 等のフィールド名と一致）
 *           displayName（UI 表示用、例「東京駅」）
 *           transitName（Yahoo!乗換案内 検索クエリ用、例「東京」）
 *           category（quick / popular の UI 分類）
 *
 * scripts/build_stations_geojson_v3.py の DESTINATIONS list と
 * slug がペアになっている必要がある。新規追加時は両方同時に編集すること。
 */

export interface DestinationMeta {
  slug:        string
  displayName: string
  transitName: string
  category:    'quick' | 'popular'  // quick = ASK の主役 3 駅、popular = 展開時の 27 駅
}

export const DESTINATIONS_META: readonly DestinationMeta[] = [
  // Quick (DestinationAsk 主役・DestinationPicker タブに表示)
  { slug: 'shinjuku',       displayName: '新宿',         transitName: '新宿',     category: 'quick' },
  { slug: 'shibuya',        displayName: '渋谷',         transitName: '渋谷',     category: 'quick' },
  { slug: 'tokyo',          displayName: '東京駅',       transitName: '東京',     category: 'quick' },

  // Popular (展開時の 27 駅)
  { slug: 'ikebukuro',      displayName: '池袋',         transitName: '池袋',     category: 'popular' },
  { slug: 'shinagawa',      displayName: '品川',         transitName: '品川',     category: 'popular' },
  { slug: 'otemachi',       displayName: '大手町',       transitName: '大手町',   category: 'popular' },
  { slug: 'roppongi',       displayName: '六本木',       transitName: '六本木',   category: 'popular' },
  { slug: 'toranomon',      displayName: '虎ノ門',       transitName: '虎ノ門',   category: 'popular' },
  { slug: 'shimbashi',      displayName: '新橋',         transitName: '新橋',     category: 'popular' },
  { slug: 'akihabara',      displayName: '秋葉原',       transitName: '秋葉原',   category: 'popular' },
  { slug: 'yurakucho',      displayName: '有楽町',       transitName: '有楽町',   category: 'popular' },
  { slug: 'hamamatsucho',   displayName: '浜松町',       transitName: '浜松町',   category: 'popular' },
  { slug: 'tamachi',        displayName: '田町',         transitName: '田町',     category: 'popular' },
  { slug: 'osaki',          displayName: '大崎',         transitName: '大崎',     category: 'popular' },
  { slug: 'gotanda',        displayName: '五反田',       transitName: '五反田',   category: 'popular' },
  { slug: 'meguro',         displayName: '目黒',         transitName: '目黒',     category: 'popular' },
  { slug: 'takadanobaba',   displayName: '高田馬場',     transitName: '高田馬場', category: 'popular' },
  { slug: 'iidabashi',      displayName: '飯田橋',       transitName: '飯田橋',   category: 'popular' },
  { slug: 'kanda',          displayName: '神田',         transitName: '神田',     category: 'popular' },
  { slug: 'ochanomizu',     displayName: '御茶ノ水',     transitName: '御茶ノ水', category: 'popular' },
  { slug: 'akasakamitsuke', displayName: '赤坂見附',     transitName: '赤坂見附', category: 'popular' },
  { slug: 'omotesando',     displayName: '表参道',       transitName: '表参道',   category: 'popular' },
  { slug: 'yokohama',       displayName: '横浜',         transitName: '横浜',     category: 'popular' },
  { slug: 'minatomirai',    displayName: 'みなとみらい', transitName: 'みなとみらい', category: 'popular' },
  { slug: 'musashikosugi',  displayName: '武蔵小杉',     transitName: '武蔵小杉', category: 'popular' },
  { slug: 'omiya',          displayName: '大宮',         transitName: '大宮',     category: 'popular' },
  { slug: 'chiba',          displayName: '千葉',         transitName: '千葉',     category: 'popular' },
  { slug: 'tachikawa',      displayName: '立川',         transitName: '立川',     category: 'popular' },
  { slug: 'oshiage',        displayName: '押上',         transitName: '押上',     category: 'popular' },
  { slug: 'toyosu',         displayName: '豊洲',         transitName: '豊洲',     category: 'popular' },
] as const

/** 全 fixed destination の slug union 型。`as const` から自動推導。 */
export type FixedDestination = typeof DESTINATIONS_META[number]['slug']

/** Quick 3 駅と Popular 27 駅 + custom を含む全 destination 型。 */
export type Destination = FixedDestination | 'custom'

/** Quick 3 駅のみ（DestinationAsk と DestinationPicker のタブで表示） */
export const QUICK_DESTINATIONS: readonly DestinationMeta[] =
  DESTINATIONS_META.filter(d => d.category === 'quick')

/** Popular 27 駅のみ（展開時に表示） */
export const POPULAR_DESTINATIONS: readonly DestinationMeta[] =
  DESTINATIONS_META.filter(d => d.category === 'popular')

/** Fixed destinations の slug 一覧（型ガード用） */
export const FIXED_DESTINATION_SLUGS: readonly string[] =
  DESTINATIONS_META.map(d => d.slug)

/** slug → DestinationMeta の O(1) ルックアップ表 */
const BY_SLUG: Record<string, DestinationMeta> =
  Object.fromEntries(DESTINATIONS_META.map(d => [d.slug, d]))

/**
 * Fixed destination の display 名を返す。custom はここでは扱わない（呼出側で fallback）。
 */
export function getDestinationDisplayName(d: FixedDestination): string {
  return BY_SLUG[d]?.displayName ?? d
}

/**
 * Fixed destination の Yahoo!乗換案内 検索用駅名を返す。
 */
export function getDestinationTransitName(d: FixedDestination): string {
  return BY_SLUG[d]?.transitName ?? d
}

/**
 * 与えられた slug が fixed destination の正規 slug か検証。
 */
export function isFixedDestination(d: string): d is FixedDestination {
  return d in BY_SLUG
}
