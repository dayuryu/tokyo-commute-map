import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import RyugakuQuiz from '@/components/ryugaku/RyugakuQuiz'

const SITE_URL = 'https://kayoha.com'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await params
  const title = '东京留学居住人格测试'
  const description =
    '24 道题测出你的东京留学居住人格——16 型 + 隐藏型，以及你的本命车站。马场修行僧？港区のセレブ？还是 Warabistan 开拓者？由 Kayoha 制作。'
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/ryugaku` },
    openGraph: {
      title: '东京留学居住人格测试 — 你是哪种东京留学生？',
      description,
      url: `${SITE_URL}/ryugaku`,
      type: 'website',
      images: ['/opengraph-image.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: '东京留学居住人格测试 — 你是哪种东京留学生？',
      description,
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
