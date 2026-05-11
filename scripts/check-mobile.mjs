// 自動でモバイルビューを検査するスクリプト。
// system Chrome を使うため chromium のダウンロードは不要。
//
// 使い方: node scripts/check-mobile.mjs
// 出力: コンソールに DIAG JSON、ファイルに welcome / story の screenshot
import puppeteer from 'puppeteer-core'
import path from 'path'

const CHROME_PATH = String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
const URL = 'http://localhost:3000'
const OUT_DIR = path.resolve('F:/supermap/auto-screenshots')
const fs = await import('fs')
fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({
  width: 375, height: 667,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
await page.setUserAgent(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)

// localStorage クリアして必ず Welcome を出す
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.removeItem('tcm.visited.v1'))
await page.reload({ waitUntil: 'networkidle2' })

// hero phase の打字机 + subtitle を撮る (約 1.5s 後)
await new Promise(r => setTimeout(r, 1800))
await page.screenshot({
  path: path.join(OUT_DIR, '1-welcome-hero.png'),
  fullPage: false,
})

// confirm phase に入るまで待つ (mount から 約 4.0s)
await new Promise(r => setTimeout(r, 2500))
await page.screenshot({
  path: path.join(OUT_DIR, '2-welcome-confirm.png'),
  fullPage: false,
})

// DOM 診断
const diag = await page.evaluate(() => {
  const meta = document.querySelector('meta[name="viewport"]')
  const cards = [...document.querySelectorAll('div')].filter(d => {
    const s = d.getAttribute('style') || ''
    return s.includes('blur(28px)')
  })
  const card = cards.find(c => c.getBoundingClientRect().width > 100)
  const h1 = document.querySelector('h1')
  const buttons = [...document.querySelectorAll('button')].filter(b =>
    /地図を開く|物語を読む/.test(b.textContent || '')
  )
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    matchMedia_max639: window.matchMedia('(max-width: 639px)').matches,
    viewport_meta: meta?.getAttribute('content') || 'MISSING',
    card: card
      ? { w: Math.round(card.getBoundingClientRect().width),
          h: Math.round(card.getBoundingClientRect().height),
          x: Math.round(card.getBoundingClientRect().x),
          y: Math.round(card.getBoundingClientRect().y) }
      : 'NOT FOUND',
    h1_fontSize: h1 ? getComputedStyle(h1).fontSize : 'NOT FOUND',
    button_widths: buttons.map(b => Math.round(b.getBoundingClientRect().width)),
    body_scrollWidth: document.documentElement.scrollWidth,
    overflow_x: document.documentElement.scrollWidth > window.innerWidth,
  }
})
console.log('========== WELCOME DIAG ==========')
console.log(JSON.stringify(diag, null, 2))

// 「先に物語を読む」ボタンを clip → tap で確実に発火させる
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b =>
    /物語を読む/.test(b.textContent || '')
  )
  if (!btn) return false
  btn.click()
  return true
})
console.log('Ghost button clicked:', clicked)

if (clicked) {
  // welcome closing (900ms) + story fade-in
  await new Promise(r => setTimeout(r, 1800))
  await page.screenshot({
    path: path.join(OUT_DIR, '3-story-page0-title.png'),
    fullPage: false,
  })

  // Story scroll は wheel イベント。コンテナにフォーカスしてから wheel
  const scrollOnce = async () => {
    await page.mouse.move(187, 333)
    await page.mouse.wheel({ deltaY: 100 })
    await new Promise(r => setTimeout(r, 1100))
  }

  // 章一（旅人）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '4-story-arrival.png'), fullPage: false })

  // 章二（定規）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '5-story-ruler.png'), fullPage: false })

  // 章三（老婆）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '6-story-oldwoman.png'), fullPage: false })

  // 章四（rings）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '7-story-rings.png'), fullPage: false })

  // 章五（時計 minutes）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '8-story-minutes.png'), fullPage: false })

  // 章終（CTA）
  await scrollOnce()
  await page.screenshot({ path: path.join(OUT_DIR, '9-story-coda.png'), fullPage: false })

  const storyDiag = await page.evaluate(() => {
    const sections = document.querySelectorAll('section')
    return {
      total_sections: sections.length,
      overflow_x: document.documentElement.scrollWidth > window.innerWidth,
      body_scrollWidth: document.documentElement.scrollWidth,
    }
  })
  console.log('========== STORY DIAG ==========')
  console.log(JSON.stringify(storyDiag, null, 2))
}

await browser.close()
console.log(`\nSaved screenshots to: ${OUT_DIR}`)
