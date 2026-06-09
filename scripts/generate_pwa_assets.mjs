// ──────────────────────────────────────────────────────────────────────────
// PWA アセット生成（アイコン PNG + iOS 起動スプラッシュ画像）
//
// 依存を増やさず、本機にある puppeteer-core + Edge で SVG/HTML を実ピクセルに
// ラスタライズする。Chrome は本機に無いので Edge を使う（B000633 / Win11）。
//
//   PYTHONIOENCODING=utf-8 node scripts/generate_pwa_assets.mjs
//
// 出力:
//   public/icons/icon-192.png / icon-512.png        … purpose "any"（角丸+枠+通）
//   public/icons/maskable-192.png / maskable-512.png … purpose "maskable"（全面赤+通、安全域内）
//   public/splash/apple-splash-<w>-<h>.png          … iOS 起動画面（各デバイス px）
//
// スプラッシュのデバイス定義は lib/pwa-splash-screens.ts と数値を一致させること
// （あちらが <link rel=apple-touch-startup-image> の media query 側 SSOT）。
// ──────────────────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer-core'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE =
  process.env.EDGE_BIN ||
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

// ── ブランド ─────────────────────────────────────────────
const RED = '#a8332b'
const CREAM = '#faf8f5' // = manifest background_color（standalone 背景と一致）
const PAPER = '#f5e7d2'
const INK = '#1f1d18'
const INK_SOFT = '#5b574c'
// 「通」を確実に描くための明朝スタック（Edge/Windows は Yu/MS Mincho を持つ）
const SEAL_FONT =
  "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho','YuMincho','MS Mincho','Noto Serif JP',serif"
const SERIF =
  "'Cormorant Garamond','Hiragino Mincho ProN','Yu Mincho','Georgia',serif"

// 通シール（角丸 + 内枠 + grain）— ブランド app/icon.svg と同デザイン
function sealSvg(size, { round = true, frame = true, glyphRatio = 0.72 } = {}) {
  const fs = Math.round(size * glyphRatio)
  const r = round ? Math.round(size * 0.012) : 0
  const inset = Math.round(size * 0.055)
  const frameRect = frame
    ? `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" fill="none" stroke="${PAPER}" stroke-opacity=".55" stroke-width="${Math.max(1, size * 0.004)}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs><pattern id="g" x="0" y="0" width="${size * 0.012}" height="${size * 0.012}" patternUnits="userSpaceOnUse">
      <circle cx="${size * 0.006}" cy="${size * 0.006}" r="${size * 0.0014}" fill="#7a1c14" opacity=".25"/>
    </pattern></defs>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${RED}"/>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
    ${frameRect}
    <text x="${size / 2}" y="${size / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="central"
          fill="${PAPER}" font-weight="700" font-family="${SEAL_FONT}">通</text>
  </svg>`
}

// ── アイコン定義 ─────────────────────────────────────────
// any: ブランド通りの角丸+枠。maskable: OS が円/角丸でクロップするので
//   全面ブリード（角丸なし・枠なし）+ 通を安全域(中央 ~60%)に収める。
const ICONS = [
  { file: 'icons/icon-192.png', dir: 'public', size: 192, opts: { round: true, frame: true, glyphRatio: 0.72 } },
  { file: 'icons/icon-512.png', dir: 'public', size: 512, opts: { round: true, frame: true, glyphRatio: 0.72 } },
  { file: 'icons/maskable-192.png', dir: 'public', size: 192, opts: { round: false, frame: false, glyphRatio: 0.56 } },
  { file: 'icons/maskable-512.png', dir: 'public', size: 512, opts: { round: false, frame: false, glyphRatio: 0.56 } },
  // iOS apple-touch-icon: iOS が自動で角丸マスクを掛ける。内枠を付けると四隅が
  //   角丸で切れて「直線が途切れる」ため frame:false。round も false（PNG 側で
  //   角丸を付けると二重になるので方形のまま iOS に任せる）。
  { file: 'apple-icon.png', dir: 'app', size: 180, opts: { round: false, frame: false, glyphRatio: 0.64 } },
]

// ── スプラッシュのデバイス（lib/pwa-splash-screens.ts と一致させること）──
// { w, h: 論理 pt（portrait）, dpr }
const SPLASH_DEVICES = [
  // iPhone
  { w: 375, h: 667, dpr: 2 }, // SE2/SE3, 6/7/8
  { w: 414, h: 736, dpr: 3 }, // 6+/7+/8+
  { w: 375, h: 812, dpr: 3 }, // X/XS/11Pro/12mini/13mini
  { w: 414, h: 896, dpr: 2 }, // XR/11
  { w: 414, h: 896, dpr: 3 }, // XSMax/11ProMax
  { w: 390, h: 844, dpr: 3 }, // 12/13/14
  { w: 428, h: 926, dpr: 3 }, // 12/13ProMax, 14Plus
  { w: 393, h: 852, dpr: 3 }, // 14Pro/15/15Pro/16
  { w: 430, h: 932, dpr: 3 }, // 14ProMax/15Plus/15ProMax/16Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  // iPad
  { w: 768, h: 1024, dpr: 2 }, // mini/9.7
  { w: 810, h: 1080, dpr: 2 }, // 10.2
  { w: 834, h: 1112, dpr: 2 }, // 10.5/Air
  { w: 820, h: 1180, dpr: 2 }, // 10.9 Air/iPad10
  { w: 834, h: 1194, dpr: 2 }, // 11" Pro
  { w: 1024, h: 1366, dpr: 2 }, // 12.9" Pro
  { w: 744, h: 1133, dpr: 2 }, // mini 6
]

// スプラッシュ HTML（論理 px でレイアウト → dpr で実 px に）
function splashHtml(w, h) {
  const sealPt = Math.round(Math.min(w, h) * 0.2)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px;overflow:hidden}
    .wrap{width:${w}px;height:${h}px;background:${CREAM};
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h*0.028)}px}
    .seal{width:${sealPt}px;height:${sealPt}px;border-radius:${Math.round(sealPt*0.06)}px;
      box-shadow:0 ${Math.round(sealPt*0.06)}px ${Math.round(sealPt*0.18)}px rgba(122,28,20,.22)}
    .word{font-family:${SERIF};font-size:${Math.round(Math.min(w,h)*0.072)}px;font-weight:600;
      letter-spacing:.04em;color:${INK}}
    .tag{font-family:${SEAL_FONT};font-size:${Math.round(Math.min(w,h)*0.032)}px;color:${INK_SOFT};
      letter-spacing:.06em}
  </style></head><body><div class="wrap">
    <div class="seal">${sealSvg(sealPt, { round: true, frame: true, glyphRatio: 0.72 })}</div>
    <div class="word">Kayoha</div>
    <div class="tag">次の駅で、暮らしをめくる。</div>
  </div></body></html>`
}

const splashFile = (d) => `splash/apple-splash-${d.w * d.dpr}-${d.h * d.dpr}.png`

async function run() {
  // 引数で対象を絞れる: `node generate_pwa_assets.mjs icons` / `... splash`
  const only = process.argv[2] // 'icons' | 'splash' | undefined(=全部)

  await mkdir(join(ROOT, 'public/icons'), { recursive: true })
  await mkdir(join(ROOT, 'public/splash'), { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  })
  const page = await browser.newPage()

  // ── アイコン ──
  if (only !== 'splash')
  for (const ic of ICONS) {
    await page.setViewport({ width: ic.size, height: ic.size, deviceScaleFactor: 1 })
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><body style="margin:0">${sealSvg(ic.size, ic.opts)}</body>`,
      { waitUntil: 'domcontentloaded' }
    )
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null))
    await sleep(120)
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: ic.size, height: ic.size },
      omitBackground: true,
    })
    await writeFile(join(ROOT, ic.dir, ic.file), buf)
    console.log(`icon  ${ic.dir}/${ic.file}  (${buf.length} B)`)
  }

  // ── スプラッシュ ──
  if (only !== 'icons')
  for (const d of SPLASH_DEVICES) {
    await page.setViewport({ width: d.w, height: d.h, deviceScaleFactor: d.dpr })
    await page.setContent(splashHtml(d.w, d.h), { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null))
    await sleep(120)
    const buf = await page.screenshot({ type: 'png' })
    const file = splashFile(d)
    await writeFile(join(ROOT, 'public', file), buf)
    console.log(`splash ${file}  ${d.w * d.dpr}x${d.h * d.dpr}  (${buf.length} B)`)
  }

  await browser.close()
  console.log(`\nDONE: ${ICONS.length} icons + ${SPLASH_DEVICES.length} splash screens`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
