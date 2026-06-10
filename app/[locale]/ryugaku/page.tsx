import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import RyugakuQuiz from '@/components/ryugaku/RyugakuQuiz'
import { computeResult, decodeAnswers, resultFace } from '@/lib/ryugaku/scoring'

const SITE_URL = 'https://kayoha.com'

// ?a=（分享结果）に応じて og:title/description/image を動的生成する。
// 微信爬虫は JS を実行しないため SSR メタデータが必須 — searchParams 参照で
// 本頁は SSG → dynamic rendering に変わる（軽量頁なので許容、2026-06-10 決定）。
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  await params
  const sp = await searchParams
  const a = typeof sp.a === 'string' ? sp.a : undefined

  let title = '东京留学居住人格测试'
  let ogTitle = '东京留学居住人格测试 — 你是哪种东京留学生？'
  let description =
    '24 道题测出你的东京留学居住人格——16 型 + 隐藏型，以及你的本命车站。马场修行僧？港区名流？还是西船桥追光者？由 Kayoha 制作。'
  let ogImage: { url: string; width: number; height: number } | string = '/opengraph-image.png'

  if (a) {
    const answers = decodeAnswers(a)
    if (answers) {
      const result = computeResult(answers)
      const face = resultFace(result)
      const t = result.hidden?.key ?? result.code
      title = `我是「${face.name}」(${face.code})`
      ogTitle = `我是「${face.name}」(${face.code}) — 东京留学居住人格测试`
      description = `${face.slogan} 你也来测测你的本命车站？`
      // v=2: v2.1 で称号主役のレイアウトに変更。route 側は s-maxage=1y immutable のため
      // 版式変更時はここの version を上げて CDN/微信キャッシュを bust する
      ogImage = { url: `${SITE_URL}/api/ryugaku-og?t=${encodeURIComponent(t)}&v=2`, width: 800, height: 800 }
    }
  }

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/ryugaku` },
    openGraph: {
      title: ogTitle,
      description,
      url: `${SITE_URL}/ryugaku`,
      type: 'website',
      images: [ogImage],
    },
  }
}

export default async function RyugakuPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense fallback={null}>
      <RyugakuQuiz />
    </Suspense>
  )
}
