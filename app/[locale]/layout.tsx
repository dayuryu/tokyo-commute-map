import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import {
  Shippori_Mincho,
  Cormorant_Garamond,
  Inter,
  JetBrains_Mono,
  Noto_Serif_SC,
  Noto_Sans_SC,
} from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { routing } from '@/i18n/routing'

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

// 中文 (简体) ロケール用 — Shippori Mincho は簡体専字 (说/图/们/您 等) を含まず
// Windows 系統 fallback (微软雅黑) に堕ちて明朝/黒体が混在し調性が乱れる。
// Noto Serif SC (思源宋体简体) は Adobe/Google CJK 同源 family で Shippori と
// ビジュアル整合、Noto Sans SC は UI sans。
// preload: false で Latin ページの初期 fetch を節約 (zh ロケール時のみ load)。
const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  preload: false,
  variable: '--font-noto-serif-sc',
  display: 'swap',
})

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  preload: false,
  variable: '--font-noto-sans-sc',
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

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

type Props = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  // BCP-47 形式 (ja-JP / zh-CN / en) に正規化。<html lang> は accessibility と
  // Google の言語識別に効く。
  const htmlLang = locale === 'ja' ? 'ja' : locale === 'zh' ? 'zh-CN' : 'en'

  return (
    <html
      lang={htmlLang}
      className={`${shippori.variable} ${cormorant.variable} ${inter.variable} ${jetbrains.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}
    >
      <body className="overflow-hidden h-[100dvh] w-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
