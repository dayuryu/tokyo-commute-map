/**
 * GET /api/yahoo-redirect?from=<出発駅>&to=<到着駅>
 *
 * Yahoo!乗換案内 への外部リンクを「自サイト経由の 302」にするための endpoint。
 *
 * なぜ必要か:
 *   直接 transit.yahoo.co.jp/search/result?... を <a href> にすると、iOS の
 *   Universal Link が Yahoo!乗換案内 アプリを起動する。アプリは web URL の時刻
 *   parameter (hh/m1/m2) を読まないため検索が「現在時刻」になり、当サイトの通勤
 *   時間基準 (平日 08:30) と数時間単位で乖離する (= 修正前の不具合)。
 *   iOS は「redirect で到達した Universal Link」はアプリに渡さない (直接タップの
 *   みアプリ起動) 仕様のため、この endpoint を一段挟むとモバイル Safari で開き、
 *   時刻 parameter が有効になる。
 *
 * セキュリティ: redirect 先の host は transit.yahoo.co.jp 固定 (buildYahooTransitUrl
 * 内でハードコード)。from/to は query として URL encode されるだけで host は変えら
 * れないため open redirect にはならない。
 *
 * 時刻: 出発時刻は buildYahooTransitUrl が「click 時の次の平日 08:30 JST」を
 * server 側で確定する (render 時刻ではなく click 時刻基準になり、より正確)。
 */
import { NextResponse } from 'next/server'
import { buildYahooTransitUrl } from '@/lib/yahoo-url'

// 出発時刻 (日付) が日々変わるため静的最適化させない
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')?.trim()
  const to = searchParams.get('to')?.trim()

  // from/to が揃っていれば時刻指定付きの検索 URL、欠けていれば Yahoo!乗換案内
  // トップへ素直に逃がす (壊れたリンクにしない)
  const target = from && to
    ? buildYahooTransitUrl(from, to)
    : 'https://transit.yahoo.co.jp/'

  const res = NextResponse.redirect(target, 302)
  // 日付入り URL を CDN/ブラウザにキャッシュさせない (翌日に古い日付へ飛ぶのを防ぐ)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
