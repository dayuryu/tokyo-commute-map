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
  title: {
    default: 'Kayoha — 次の駅で、暮らしをめくる。',
    template: '%s | Kayoha',
  },
  description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
  keywords: ['通勤時間', '東京', '駅', '家賃', '引っ越し', '住む街', 'AI 推薦', '通勤地図', 'Kayoha', '通葉'],
  authors: [{ name: 'Kayoha' }],
  applicationName: 'Kayoha',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Kayoha — 次の駅で、暮らしをめくる。',
    description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
    url: 'https://kayoha.com',
    siteName: 'Kayoha',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Kayoha — 次の駅で、暮らしをめくる。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kayoha — 次の駅で、暮らしをめくる。',
    description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
    images: ['/opengraph-image.png'],
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://kayoha.com/#website',
      name: 'Kayoha',
      alternateName: '通葉',
      url: 'https://kayoha.com',
      description: '東京圏 1843 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
      inLanguage: 'ja-JP',
      publisher: { '@id': 'https://kayoha.com/#organization' },
    },
    {
      '@type': 'Organization',
      '@id': 'https://kayoha.com/#organization',
      name: 'Kayoha',
      alternateName: '通葉',
      url: 'https://kayoha.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://kayoha.com/apple-icon.png',
        width: 180,
        height: 180,
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${shippori.variable} ${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="overflow-hidden h-[100dvh] w-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
