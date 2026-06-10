// /ryugaku 微信分享用 OG 图（1:1 正方形 — 微信聊天卡片缩略图按方形裁切）
// GET /api/ryugaku-og?t=PCRI | t=dekasegi（主型 4 字母 code 或隐藏型 key）
// 设计：型色满底 + cream 大字，缩到聊天列表 49px 时仍能认出"色 + 标题"。
// 字体：按需取 Google Fonts 的 text= 子集（每型只含所需字形，~几 KB），边缘函数内 fetch。
import { ImageResponse } from 'next/og'
import { PERSONA_BY_CODE, HIDDEN_PERSONAS } from '@/lib/ryugaku/quiz-data'

export const runtime = 'edge'

const SIZE = 800
const CREAM = '#faf8f5'

/** Google Fonts css2 的 text= 子集 trick：非现代 UA 会返回 truetype 单文件 */
async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url =
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}` +
      `:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
    const m = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
    if (!m) return null
    const res = await fetch(m[1])
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  const persona = PERSONA_BY_CODE[t] ?? HIDDEN_PERSONAS[t] ?? null

  // 未知 t 时落品牌默认卡（分享链接被改坏也不出 500）
  const color = persona?.color ?? '#a8332b'
  const name = persona?.name ?? '东京留学居住人格测试'
  const nameJa = persona?.nameJa ?? '東京、どこに住む？'
  const code = persona && 'code' in persona ? persona.code : ''

  const caption = '东京留学居住人格测试'
  const zhText = name + caption + code + '留'
  const [zhFont, jaFont] = await Promise.all([
    loadGoogleFont('Noto Serif SC', 600, zhText),
    loadGoogleFont('Shippori Mincho', 500, nameJa),
  ])
  if (!zhFont) {
    // satori 无字体无法排版任何字形 — 缩退为无图（微信会落到站点 icon）
    return new Response('og font unavailable', { status: 503 })
  }

  const fonts = [
    { name: 'serif-sc', data: zhFont, weight: 600 as const, style: 'normal' as const },
    ...(jaFont ? [{ name: 'serif-ja', data: jaFont, weight: 500 as const, style: 'normal' as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: color,
          color: CREAM,
          fontFamily: 'serif-sc',
          position: 'relative',
        }}
      >
        {/* 内框（印刷感） */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: `2px solid ${CREAM}`,
            opacity: 0.45,
            borderRadius: 4,
          }}
        />
        {/* 右上印章 */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            right: 56,
            width: 84,
            height: 84,
            background: CREAM,
            color,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
          }}
        >
          留
        </div>

        {code ? (
          <div style={{ fontSize: 64, letterSpacing: 14, opacity: 0.85, display: 'flex' }}>{code}</div>
        ) : null}
        <div
          style={{
            fontSize: name.length >= 7 ? 96 : 112,
            marginTop: 18,
            display: 'flex',
            textAlign: 'center',
            lineHeight: 1.2,
            padding: '0 60px',
          }}
        >
          {name}
        </div>
        {jaFont ? (
          <div
            style={{
              fontFamily: 'serif-ja',
              fontSize: 34,
              letterSpacing: 5,
              marginTop: 26,
              opacity: 0.9,
              display: 'flex',
            }}
          >
            {nameJa}
          </div>
        ) : null}

        <div
          style={{
            position: 'absolute',
            bottom: 62,
            fontSize: 26,
            letterSpacing: 8,
            opacity: 0.8,
            display: 'flex',
          }}
        >
          {caption}
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      fonts,
      headers: {
        // t 固定 → 图固定。CDN 长缓存，浏览器一天
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    },
  )
}
