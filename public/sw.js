/*
 * Kayoha Service Worker（依存ゼロの手書き）
 *
 * 方針: progressive enhancement。SW が無くても全機能は動く。役割は
 *  (1) standalone 起動時の体感速度（_next/static を cache-first）
 *  (2) 「地下鉄内でも地図が出る」= openfreemap タイルのオフライン化
 *  (3) 完全オフライン時の navigation 兜底（offline.html）
 *
 * バージョンを上げると activate で旧キャッシュを掃除する。
 */
const VERSION = 'v1'
const STATIC_CACHE = `kayoha-static-${VERSION}` // _next/static, fonts, アイコン
const TILES_CACHE = `kayoha-tiles-${VERSION}` //  openfreemap タイル/glyph/sprite
const DATA_CACHE = `kayoha-data-${VERSION}` //   /data/*.json (geojson 等)
const PAGES_CACHE = `kayoha-pages-${VERSION}` //  navigation HTML / RSC
const OFFLINE_URL = '/offline.html'
const TILE_CACHE_MAX = 400 // タイルは無限に貯めない（LRU 近似で trim）

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(c => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(n => n.startsWith('kayoha-') && !n.endsWith(`-${VERSION}`))
          .map(n => caches.delete(n))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  // Range 要求（welcome-bg.mp4 のシーク等）は SW を通さない — 部分応答を
  // キャッシュすると壊れる。
  if (req.headers.has('range')) return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const sameOrigin = url.origin === self.location.origin

  // ── 地図タイル/glyph/sprite（openfreemap, 跨域・CORS 有）──
  // オフライン地図の核心。cache-first + 上限 trim。
  if (url.hostname.endsWith('openfreemap.org')) {
    event.respondWith(cacheFirstCapped(req, TILES_CACHE, TILE_CACHE_MAX))
    return
  }

  // 跨域フォント（next/font は自己ホストだが保険）
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // その他の跨域（Supabase / OpenAI / GA / Vercel insights）は素通し
  if (!sameOrigin) return

  // ── 同源 ──
  if (url.pathname.startsWith('/api/')) return // 動的・限流。絶対にキャッシュしない
  if (url.pathname.endsWith('.mp4')) return // 動画は大 + Range。SW を通さない

  // ハッシュ付き不変アセット → cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // PWA アセット / 静的アイコン → cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/splash/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/apple-icon.png' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/opengraph-image.png' ||
    url.pathname === '/welcome-poster.jpg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // データ JSON（stations.geojson / area_features / rent 等）→ SWR
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE))
    return
  }

  // ページ遷移（HTML）→ network-first → 離線は cache → offline.html
  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(req))
    return
  }

  // その他の同源 GET（RSC payload 等）→ SWR
  event.respondWith(staleWhileRevalidate(req, PAGES_CACHE))
})

// ── strategies ────────────────────────────────────────────────
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    if (res && res.ok) cache.put(req, res.clone())
    return res
  } catch {
    return hit || Response.error()
  }
}

async function cacheFirstCapped(req, cacheName, max) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      await cache.put(req, res.clone())
      trimCache(cacheName, max)
    }
    return res
  } catch {
    return hit || Response.error()
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  const network = fetch(req)
    .then(res => {
      if (res && res.ok) cache.put(req, res.clone())
      return res
    })
    .catch(() => hit)
  return hit || network
}

async function navigationHandler(req) {
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const cache = await caches.open(PAGES_CACHE)
      cache.put(req, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    return offline || Response.error()
  }
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const overflow = keys.length - max
  if (overflow <= 0) return
  // keys() は挿入順 ≒ 古い順。先頭から overflow 件を削除（LRU 近似）。
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i])
}
