import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Kayoha — 次の駅で、暮らしをめくる。',
    short_name: 'Kayoha',
    description:
      '東京圏 1831 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
    // PWA 起動を計測できるよう source を付与（GA4 で homescreen 流入を識別）。
    // localeDetection は query を保持したまま /、/en、/zh に振り分ける。
    start_url: '/?utm_source=pwa&utm_medium=homescreen',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'ja',
    dir: 'ltr',
    categories: ['travel', 'lifestyle', 'navigation'],
    background_color: '#faf8f5',
    theme_color: '#a8332b',
    icons: [
      // 旧来の汎用アイコン（後方互換）
      { src: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // Android / Chrome の installability 基準（192 + 512 PNG）
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // adaptive icon（ホーム画面で OS が円/角丸にクロップ）
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // iOS ホーム画面アイコン（Next が app/apple-icon.png も自動配信するが明示）
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
