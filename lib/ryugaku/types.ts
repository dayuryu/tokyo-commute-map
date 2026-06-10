// 东京留学居住人格测试（/ryugaku）类型定义
// 设计施工图见 docs/ryugaku-quiz-design.md

/** 四个维度轴 */
export type AxisKey = 'budget' | 'community' | 'goal' | 'geo'

/** 轴的一极（字母 + 中文标签） */
export type Pole = { letter: string; label: string }

export type Axis = {
  key: AxisKey
  emoji: string
  /** 轴名（结果页四维雷达用） */
  label: string
  /** 正分极（得分 > 0 时取这个字母） */
  pos: Pole
  /** 负分极（得分 < 0 时取这个字母） */
  neg: Pole
}

/** 5 级量表的一个回答：-2(非常不同意) .. +2(非常同意) */
export type Likert = -2 | -1 | 0 | 1 | 2

export type Question = {
  id: string
  text: string
  axis: AxisKey
  /** +1: 同意→正分极；-1: 反向题，同意→负分极 */
  direction: 1 | -1
}

/** 隐藏型 key */
export type HiddenKey =
  | 'pilgrim' // 圣地巡礼者
  | 'otome' // 中野乙女
  | 'serebu' // 港区名流
  | 'dekasegi' // 蒲田打工战神
  | 'fukushi' // 福祉大幸存者
  | 'nishikasai' // 西葛西咖喱党

/** 彩蛋题：高分给某隐藏型加权 */
export type BonusQuestion = {
  id: string
  text: string
  signal: HiddenKey
}

/** 4 字母型号，如 'PCRI' */
export type PersonaCode = string

export type Persona = {
  code: PersonaCode
  /** 中文主标题（简洁有力，纯中文，不混の） */
  name: string
  /** 日文副句（主题呼应、非直译；展示时必须用日文字体 + lang="ja"） */
  nameJa: string
  slogan: string
  /** 代表色（MBTI 式分组配色，结果页主题色） */
  color: string
  /** 本命车站（中文显示名，结果页展示用） */
  stations: string[]
  /** 本命车站的 geojson 正规站名（含消歧后缀，地图高亮导流用，与 stations 同序） */
  stationKeys: string[]
  /** 都心 I / 远郊 O（分组展示用） */
  zone: 'inner' | 'outer'
}

export type HiddenPersona = {
  key: HiddenKey
  name: string
  nameJa: string
  slogan: string
  color: string
  stations: string[]
  stationKeys: string[]
}

/** 四轴累计分（正负决定字母） */
export type AxisScores = Record<AxisKey, number>

/** 一次测试的结果 */
export type QuizResult = {
  /** 主型 4 字母 */
  code: PersonaCode
  persona: Persona
  /** 命中的隐藏型（若有，结果页优先展示隐藏型） */
  hidden: HiddenPersona | null
  /** 各轴归一化到 -1..1（雷达图） */
  axes: AxisScores
}
