import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kayoha — 次の駅で、暮らしをめくる。',
    short_name: 'Kayoha',
    description: '東京圏 1831 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#a8332b',
    icons: [
      { src: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
