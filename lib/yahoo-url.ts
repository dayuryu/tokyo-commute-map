/**
 * Yahoo!乗換案内 URL builder
 *
 * 当前网站の通勤時間は GTFS の平日 rush-hour (7:00-9:30) pooled median を採用。
 * Yahoo 外部リンクは system clock 起点で検索するため、深夜・休日・非ラッシュ時間帯に
 * クリックすると Yahoo 結果と網站表示が大きく乖離する (e.g. 終電後 → 数時間)。
 *
 * 対策: 外部リンクに「次の平日 08:30 JST」を URL parameter で固定する。
 * これで網站の時間基準と Yahoo 検索基準が一致する。
 */

interface YahooTimeParams {
  y: string;   // 年 (YYYY)
  m: string;   // 月 (MM、補零)
  d: string;   // 日 (DD、補零)
  hh: string;  // 時 (HH、補零)
  m1: string;  // 分十位
  m2: string;  // 分個位
}

/**
 * 次の平日 (月-金) 08:30 JST を Yahoo URL 用 parameter として返す。
 * - 現在 JST が平日 08:30 未満 → 今日の 08:30
 * - それ以外 (平日 08:30 以降 / 週末) → 次の平日 08:30
 */
export function nextWeekdayMorningJst(now: Date = new Date()): YahooTimeParams {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value] as const)
  )
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const weekday = weekdayMap[parts.weekday]
  const y = parseInt(parts.year, 10)
  const mo = parseInt(parts.month, 10)
  const d = parseInt(parts.day, 10)
  const currentMin = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10)
  const targetMin = 8 * 60 + 30

  let targetY = y
  let targetMo = mo
  let targetD = d

  const isWeekdayBeforeTarget = weekday >= 1 && weekday <= 5 && currentMin < targetMin
  if (!isWeekdayBeforeTarget) {
    // 次の平日を探す: Date.UTC trick で「JST clock time as UTC」操作
    const dt = new Date(Date.UTC(y, mo - 1, d))
    do {
      dt.setUTCDate(dt.getUTCDate() + 1)
    } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6)
    targetY = dt.getUTCFullYear()
    targetMo = dt.getUTCMonth() + 1
    targetD = dt.getUTCDate()
  }

  return {
    y: String(targetY),
    m: String(targetMo).padStart(2, '0'),
    d: String(targetD).padStart(2, '0'),
    hh: '08',
    m1: '3',
    m2: '0',
  }
}

/**
 * Yahoo!乗換案内の検索 URL を組み立てる。
 * 「次の平日 08:30 JST 出発」を時刻 parameter として固定。
 *
 * @param from 出発駅名 (例: 「新宿」)
 * @param to   到着駅名 (例: 「東京」)
 */
export function buildYahooTransitUrl(from: string, to: string): string {
  const t = nextWeekdayMorningJst()
  const params = new URLSearchParams({
    from,
    to,
    y: t.y,
    m: t.m,
    d: t.d,
    hh: t.hh,
    m1: t.m1,
    m2: t.m2,
    type: '1', // 1 = 出発時刻指定
  })
  return `https://transit.yahoo.co.jp/search/result?${params.toString()}`
}
