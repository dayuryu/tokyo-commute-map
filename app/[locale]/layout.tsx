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
import Providers from '@/app/providers'
import AnalyticsGate from '@/components/AnalyticsGate'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { appleStartupImages } from '@/lib/pwa-splash-screens'

// preload: false が必須 — CJK フォントは latin-only subset を持たないため、
// next/font が preload を「全 unicode-range 切片」(364 file / ~11MB) に退化させ、
// モバイル帯域を食い尽くして LCP を破壊する (font swap の再描画が LCP 計上される)。
// false なら @font-face + unicode-range の遅延読込が働き、実際に描画する
// 文字の切片 (数十 file) だけが fetch される。
// weight 700 はプロジェクト全体で未使用 (700 を使うのは Inter / mono のみ) のため
// 宣言しない — CJK フォントは 1 weight = 約 100 個の unicode-range 切片宣言になり、
// render-blocking CSS をその分肥大させる。
const shippori = Shippori_Mincho({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  preload: false,
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
  weight: ['400', '500', '600'],
  preload: false,
  variable: '--font-noto-serif-sc',
  display: 'swap',
})

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  preload: false,
  variable: '--font-noto-sans-sc',
  display: 'swap',
})

const SITE_URL = 'https://kayoha.com'
const SITE_DESCRIPTION = '東京圏 1831 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。'
const SITE_TITLE_DEFAULT = 'Kayoha — 次の駅で、暮らしをめくる。'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  // すべての locale 変種は x-default (ja root) に canonical を統一する。
  // Lighthouse は canonical が hreflang alternate を指すと invalid 判定するため、
  // self-canonical (e.g. /zh → /zh) ではなく x-default に集約する戦略を採る。
  // 言語別ターゲティングは alternates.languages の hreflang で Google に伝える。
  const canonicalUrl = SITE_URL
  const ogLocale = locale === 'zh' ? 'zh_CN' : locale === 'en' ? 'en_US' : 'ja_JP'

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE_TITLE_DEFAULT,
      template: '%s | Kayoha',
    },
    description: SITE_DESCRIPTION,
    keywords: ['通勤時間', '東京', '駅', '家賃', '引っ越し', '住む街', 'AI 推薦', '通勤地図', 'Kayoha', '通葉'],
    authors: [{ name: 'Kayoha' }],
    applicationName: 'Kayoha',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ja: `${SITE_URL}/`,
        zh: `${SITE_URL}/zh`,
        en: `${SITE_URL}/en`,
        'x-default': `${SITE_URL}/`,
      },
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
      title: SITE_TITLE_DEFAULT,
      description: SITE_DESCRIPTION,
      url: canonicalUrl,
      siteName: 'Kayoha',
      locale: ogLocale,
      type: 'website',
      images: [
        {
          url: '/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: SITE_TITLE_DEFAULT,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_TITLE_DEFAULT,
      description: SITE_DESCRIPTION,
      images: ['/opengraph-image.png'],
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    // ── iOS PWA チューニング ──
    // capable: ホーム画面起動時に Safari chrome を隠して standalone 表示。
    // statusBarStyle 'default': welcome がクリーム色の明背景のため、白文字に
    //   なる black-translucent は不可（時計が見えず内容も status bar 下に潜る）。
    //   default は明背景で暗文字になり可読。
    // startupImage: iOS は manifest からスプラッシュを生成しないので、デバイス
    //   解像度ごとの起動画像を明示（未指定だと白画面）。SSOT は lib/pwa-splash-screens。
    appleWebApp: {
      capable: true,
      title: 'Kayoha',
      statusBarStyle: 'default',
      startupImage: appleStartupImages(),
    },
    // Next 16 は appleWebApp.capable から標準の mobile-web-app-capable を出すが、
    // iOS Safari（特に旧版）は依然 apple- 前缀の方しか認識しないため明示的に併記。
    other: {
      'apple-mobile-web-app-capable': 'yes',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  // PWA 工具栏 / Android status bar の着色（ブランド赤）。manifest の
  // theme_color と一致させる。
  themeColor: '#a8332b',
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
      description: '東京圏 1831 駅を通勤時間でカラーリング。AI 推薦・家賃目安・周辺の特徴・コミュニティ評価で、次に住む街を探す地図。',
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
          <Providers>
            {/* GA4 gate は CookieConsent と同じ Jotai store を購読する必要が
                あるため、必ず Providers の内側に置く */}
            <AnalyticsGate />
            {/* PWA: 本番のみ Service Worker を登録（オフライン地図キャッシュ） */}
            <ServiceWorkerRegistrar />
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
