// ryugaku 测试页的品牌色 token（与主站一致，独立页内联使用）
export const C = {
  red: '#a8332b',
  cream: '#faf8f5',
  paper: '#f5e7d2',
  ink: '#1f1d18',
  inkSoft: '#5b574c',
  line: 'rgba(31,29,24,0.12)',
} as const

// 本页内容是中文，但路由含 ja root（/ryugaku → html lang="ja"），
// 不能依赖 globals.css 的 :lang(zh) 覆盖 —— 字体栈在此显式分流：
// 中文一律思源宋体/黑体简体，日文副句一律 Shippori 明朝（须配 lang="ja"）。
export const SERIF =
  "var(--font-noto-serif-sc), 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif"
export const SANS =
  "var(--font-noto-sans-sc), 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
export const SERIF_JA =
  "var(--font-shippori), 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
