import type { Metadata, Viewport } from 'next'
import { Shippori_Mincho, Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const shippori = Shippori_Mincho({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-shippori',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://kayoha.com'),
  title: 'Kayoha — 次の駅で、暮らしをめくる。',
  description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
  openGraph: {
    title: 'Kayoha — 次の駅で、暮らしをめくる。',
    description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
    url: 'https://kayoha.com',
    siteName: 'Kayoha',
    locale: 'ja_JP',
    type: 'website',
  },
}

// viewport meta — モバイルで実機幅にレンダリングするために必須。
// これがないとブラウザが 980px 仮想ビューポートに描いてから縮小して
// レイアウトが崩れる + matchMedia(max-width:640px) も発火しない。
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${shippori.variable} ${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="overflow-hidden h-[100dvh] w-screen">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
