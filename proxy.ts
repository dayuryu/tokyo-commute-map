import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // i18n 対象外: API ルート / Next 内部 / Vercel 内部 / sitemap / robots /
  // 静的アセット (拡張子付き) / OG image / icon 等。
  // ページルート (`/`, `/zh`, `/en`, `/to/...`, `/legal/...`) はすべて
  // middleware を通し、as-needed mode で default locale を内部 rewrite。
  matcher: [
    '/((?!api|_next|_vercel|sitemap.xml|robots.txt|opengraph-image|icon|apple-icon|favicon|.*\\..*).*)',
  ],
}
