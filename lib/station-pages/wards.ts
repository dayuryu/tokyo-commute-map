/**
 * 区市 hub（/area/{slug}）の対象 39 自治体 SSOT。
 * 選定根拠: docs/research/station-demand-analysis-2026-06.md（23 区 + 主要 16 市）。
 * 政令市（横浜/川崎/さいたま）は station_muni.json の city が「横浜市西区」等の
 * 行政区単位で来るため、前方一致でマッチさせる（isSeirei）。
 */
export type WardMeta = {
  slug: string
  /** 表示名（=マッチキー。政令市は市名まで） */
  name: string
  pref: string
  /** 政令市: city 前方一致でマッチ */
  isSeirei?: boolean
}

export const WARDS: readonly WardMeta[] = [
  // 東京 23 区
  { slug: 'chiyoda-ku', name: '千代田区', pref: '東京都' },
  { slug: 'chuo-ku', name: '中央区', pref: '東京都' },
  { slug: 'minato-ku', name: '港区', pref: '東京都' },
  { slug: 'shinjuku-ku', name: '新宿区', pref: '東京都' },
  { slug: 'bunkyo-ku', name: '文京区', pref: '東京都' },
  { slug: 'taito-ku', name: '台東区', pref: '東京都' },
  { slug: 'sumida-ku', name: '墨田区', pref: '東京都' },
  { slug: 'koto-ku', name: '江東区', pref: '東京都' },
  { slug: 'shinagawa-ku', name: '品川区', pref: '東京都' },
  { slug: 'meguro-ku', name: '目黒区', pref: '東京都' },
  { slug: 'ota-ku', name: '大田区', pref: '東京都' },
  { slug: 'setagaya-ku', name: '世田谷区', pref: '東京都' },
  { slug: 'shibuya-ku', name: '渋谷区', pref: '東京都' },
  { slug: 'nakano-ku', name: '中野区', pref: '東京都' },
  { slug: 'suginami-ku', name: '杉並区', pref: '東京都' },
  { slug: 'toshima-ku', name: '豊島区', pref: '東京都' },
  { slug: 'kita-ku', name: '北区', pref: '東京都' },
  { slug: 'arakawa-ku', name: '荒川区', pref: '東京都' },
  { slug: 'itabashi-ku', name: '板橋区', pref: '東京都' },
  { slug: 'nerima-ku', name: '練馬区', pref: '東京都' },
  { slug: 'adachi-ku', name: '足立区', pref: '東京都' },
  { slug: 'katsushika-ku', name: '葛飾区', pref: '東京都' },
  { slug: 'edogawa-ku', name: '江戸川区', pref: '東京都' },
  // 主要 16 市
  { slug: 'musashino-shi', name: '武蔵野市', pref: '東京都' },
  { slug: 'mitaka-shi', name: '三鷹市', pref: '東京都' },
  { slug: 'chofu-shi', name: '調布市', pref: '東京都' },
  { slug: 'fuchu-shi', name: '府中市', pref: '東京都' },
  { slug: 'hachioji-shi', name: '八王子市', pref: '東京都' },
  { slug: 'tachikawa-shi', name: '立川市', pref: '東京都' },
  { slug: 'kokubunji-shi', name: '国分寺市', pref: '東京都' },
  { slug: 'machida-shi', name: '町田市', pref: '東京都' },
  { slug: 'kawasaki-shi', name: '川崎市', pref: '神奈川県', isSeirei: true },
  { slug: 'yokohama-shi', name: '横浜市', pref: '神奈川県', isSeirei: true },
  { slug: 'saitama-shi', name: 'さいたま市', pref: '埼玉県', isSeirei: true },
  { slug: 'kawaguchi-shi', name: '川口市', pref: '埼玉県' },
  { slug: 'funabashi-shi', name: '船橋市', pref: '千葉県' },
  { slug: 'ichikawa-shi', name: '市川市', pref: '千葉県' },
  { slug: 'matsudo-shi', name: '松戸市', pref: '千葉県' },
  { slug: 'urayasu-shi', name: '浦安市', pref: '千葉県' },
]

export const WARD_BY_SLUG: Record<string, WardMeta> = Object.fromEntries(
  WARDS.map(w => [w.slug, w]),
)

/** station_muni.json の city からマッチする hub を返す（無ければ null） */
export function wardOfCity(city: string | null): WardMeta | null {
  if (!city) return null
  for (const w of WARDS) {
    if (w.isSeirei ? city.startsWith(w.name) : city === w.name) return w
  }
  return null
}
