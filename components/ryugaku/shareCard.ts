// 分享卡生成器 — 纯前端 canvas 绘制，零依赖
// 1080×1440 (3:4, 小红书最优)，三色印刷风：米白底 + 墨线 + 型色
// 字体：页面已加载的 webfont（思源宋体/黑体简体 + Shippori 明朝），
// canvas 能直接用 document 字体，但 next/font 的 family 名是生成的，
// 须从 DOM 解析实际 font-family 栈（resolveFamily）。
import { AXES, AXIS_ORDER } from '@/lib/ryugaku/quiz-data'
import type { QuizResult } from '@/lib/ryugaku/types'
import { SERIF, SERIF_JA, SANS } from './theme'

const W = 1080
const H = 1440
const SCALE = 2 // 输出 2160×2880，小红书上更锐
const CREAM = '#faf8f5'
const INK = '#1f1d18'
const INK_SOFT = '#5b574c'

export type CardFace = {
  name: string
  nameJa: string
  slogan: string
  color: string
  code: string
  isHidden: boolean
}

/** next/font 的 CSS 变量 → 实际 font-family 栈（canvas 不认 var()） */
function resolveFamily(stack: string): string {
  const el = document.createElement('span')
  el.style.cssText = 'position:absolute;visibility:hidden'
  el.style.fontFamily = stack
  el.textContent = '字'
  document.body.appendChild(el)
  const fam = getComputedStyle(el).fontFamily
  el.remove()
  return fam || stack
}

/** 逐字换行（CJK），行首禁则标点不开头 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const noStart = '，。、！？；：）」』…—％%'
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    const t = cur + ch
    if (ctx.measureText(t).width > maxW && cur && !noStart.includes(ch)) {
      lines.push(cur)
      cur = ch
    } else {
      cur = t
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function buildShareCard(result: QuizResult, face: CardFace, pctText: string): Promise<Blob> {
  const serif = resolveFamily(SERIF)
  const serifJa = resolveFamily(SERIF_JA)
  const sans = resolveFamily(SANS)
  const accent = face.color

  // 确保所需字形的切片已加载（unicode-range 按需）
  const axisText = AXES.map(a => a.pos.label + a.neg.label).join('')
  const stations = result.hidden ? result.hidden.stations : result.persona.stations
  await Promise.all([
    document.fonts.load(`600 112px ${serif}`, face.code + face.name + '留' + stations.join('')),
    document.fonts.load(`500 38px ${serifJa}`, face.nameJa),
    document.fonts.load(`400 38px ${sans}`, face.slogan + '全网约和你一样东京留学居住人格测试稀有 · %0123456789.' + pctText + face.code),
    document.fonts.load(`600 26px ${sans}`, axisText),
  ]).catch(() => {/* 字体加载失败时落系统字体，不阻塞出图 */})

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'middle'

  // ── 底 + 印刷颗粒 ──
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = i % 4 === 0 ? accent : INK
    ctx.globalAlpha = 0.028
    ctx.beginPath()
    ctx.arc(Math.random() * W, Math.random() * H, 0.7 + Math.random() * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ── 双线框（外墨内型色，印刷感）──
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.strokeRect(32, 32, W - 64, H - 64)
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.55
  ctx.strokeRect(44, 44, W - 88, H - 88)
  ctx.globalAlpha = 1

  // ── 型色大圆（标题区背景motif）──
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.07
  ctx.beginPath()
  ctx.arc(540, 420, 264, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // ── 顶部 latin 字幕 ──
  ctx.font = `600 22px ${sans}`
  ctx.letterSpacing = '10px'
  ctx.textAlign = 'center'
  ctx.fillStyle = INK_SOFT
  ctx.globalAlpha = 0.75
  ctx.fillText('TOKYO RYUGAKU PERSONA', W / 2, 116)
  ctx.globalAlpha = 1
  ctx.letterSpacing = '0px'

  // ── 右上角印章「留」──
  ctx.fillStyle = accent
  roundRect(ctx, 928, 78, 76, 76, 8)
  ctx.fill()
  ctx.fillStyle = CREAM
  ctx.font = `600 48px ${serif}`
  ctx.fillText('留', 966, 120)

  // ── 右缘竖排小字 ──
  ctx.font = `500 21px ${serif}`
  ctx.fillStyle = INK_SOFT
  ctx.globalAlpha = 0.5
  const side = '东京留学居住人格测试'
  for (let i = 0; i < side.length; i++) {
    ctx.fillText(side[i], W - 76, 240 + i * 33)
  }
  ctx.globalAlpha = 1

  // ── 稀有徽章（隐藏型）──
  if (face.isHidden) {
    const label = `稀有人格 · 全网约 ${pctText}%`
    ctx.font = `600 25px ${sans}`
    const tw = ctx.measureText(label).width
    ctx.strokeStyle = accent
    ctx.lineWidth = 2.5
    roundRect(ctx, W / 2 - tw / 2 - 26, 158, tw + 52, 50, 25)
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.fillText(label, W / 2, 184)
  }

  // ── 中文标题 / 日文副句 / 代号小字 ──
  // v2.1 称号主角化：自创 4 字母代号无先验认知，最大字号让给称号；
  // 代号降为占比行前缀（QuizResult.tsx 同层级，两处需保持一致）
  ctx.textAlign = 'center'
  ctx.fillStyle = accent
  ctx.font = `600 ${face.name.length >= 7 ? 92 : 104}px ${serif}`
  ctx.fillText(face.name, W / 2, 330)

  ctx.font = `500 38px ${serifJa}`
  ctx.letterSpacing = '5px'
  ctx.fillText(face.nameJa, W / 2 + 2, 420)
  ctx.letterSpacing = '0px'

  if (!face.isHidden) {
    // 代号（serif 带字距）+ 占比（sans）拼一行，整体居中。
    // 隐藏型不出代号 — 代号属 16 主型体系，稀有徽章已承载占比
    ctx.letterSpacing = '6px'
    ctx.font = `600 30px ${serif}`
    const codeW = ctx.measureText(face.code).width
    ctx.letterSpacing = '0px'
    const rest = ` · 全网约 ${pctText}% 和你一样`
    ctx.font = `400 26px ${sans}`
    const restW = ctx.measureText(rest).width
    const left = W / 2 - (codeW + restW) / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = INK_SOFT
    ctx.letterSpacing = '6px'
    ctx.font = `600 30px ${serif}`
    ctx.fillText(face.code, left, 484)
    ctx.letterSpacing = '0px'
    ctx.globalAlpha = 0.8
    ctx.font = `400 26px ${sans}`
    ctx.fillText(rest, left + codeW, 484)
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
  }

  // ── 分隔：菱形 + 细线 ──
  const dy = 634
  ctx.strokeStyle = INK
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2 - 200, dy)
  ctx.lineTo(W / 2 - 28, dy)
  ctx.moveTo(W / 2 + 28, dy)
  ctx.lineTo(W / 2 + 200, dy)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = accent
  ctx.save()
  ctx.translate(W / 2, dy)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-7, -7, 14, 14)
  ctx.restore()

  // ── slogan（带大引号）──
  ctx.font = `400 37px ${sans}`
  const lines = wrapText(ctx, face.slogan, 820)
  const lh = 64
  const sloganTop = 706
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.3
  ctx.font = `600 120px ${serif}`
  ctx.fillText('“', 116, sloganTop + 8)
  ctx.globalAlpha = 1
  ctx.fillStyle = INK
  ctx.font = `400 37px ${sans}`
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, sloganTop + i * lh)
  }

  // ── 四维条 ──
  const axTop = 1066
  const pitch = 56
  const barL = 250
  const barR = 830
  for (let i = 0; i < AXIS_ORDER.length; i++) {
    const key = AXIS_ORDER[i]
    const axis = AXES.find(a => a.key === key)!
    const v = result.axes[key]
    const y = axTop + i * pitch
    const towardPos = v >= 0
    // 标签
    // 标签带字母 — 代号 4 字母的含义在四维条上自解释（QuizResult.tsx 同型）
    ctx.font = `${towardPos ? 600 : 400} 26px ${sans}`
    ctx.fillStyle = towardPos ? INK : INK_SOFT
    ctx.globalAlpha = towardPos ? 1 : 0.65
    ctx.textAlign = 'right'
    ctx.fillText(`${axis.pos.letter} ${axis.pos.label}`, barL - 28, y)
    ctx.globalAlpha = 1
    ctx.font = `${!towardPos ? 600 : 400} 26px ${sans}`
    ctx.fillStyle = !towardPos ? INK : INK_SOFT
    ctx.globalAlpha = !towardPos ? 1 : 0.65
    ctx.textAlign = 'left'
    ctx.fillText(`${axis.neg.label} ${axis.neg.letter}`, barR + 28, y)
    ctx.globalAlpha = 1
    // 轨道 + 点（pos 在左：v=+1 → 最左）
    ctx.strokeStyle = 'rgba(31,29,24,0.14)'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(barL, y)
    ctx.lineTo(barR, y)
    ctx.stroke()
    const cx = barL + ((1 - v) / 2) * (barR - barL)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(cx, y, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.textAlign = 'center'

  // ── 本命车站 chips ──
  const chipY = 1318
  ctx.font = `500 30px ${serif}`
  const gap = 18
  const pads = 27
  const widths = stations.map(s => ctx.measureText(s).width + pads * 2)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (stations.length - 1)
  let x = W / 2 - total / 2
  for (let i = 0; i < stations.length; i++) {
    ctx.strokeStyle = INK
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 2
    roundRect(ctx, x, chipY - 28, widths[i], 56, 28)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = INK
    ctx.fillText(stations[i], x + widths[i] / 2, chipY + 1)
    x += widths[i] + gap
  }

  // ── 页脚 ──
  ctx.font = `400 23px ${sans}`
  ctx.letterSpacing = '3px'
  ctx.fillStyle = INK_SOFT
  ctx.globalAlpha = 0.8
  ctx.fillText('你的本命车站在哪？→ kayoha.com/ryugaku', W / 2, 1388)
  ctx.globalAlpha = 1
  ctx.letterSpacing = '0px'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
