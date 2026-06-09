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
  | 'otome' // 中野乙女路の住民
  | 'serebu' // 港区のセレブ
  | 'dekasegi' // 出稼ぎ战士
  | 'fukushi' // 福祉大幸存者
  | 'nishikasai' // 西葛西の名誉インド人

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
  name: string
  slogan: string
  /** 本命车站（映射区域，结果页/导流用） */
  stations: string[]
  /** 都心 I / 远郊 O（分组展示用） */
  zone: 'inner' | 'outer'
}

export type HiddenPersona = {
  key: HiddenKey
  name: string
  slogan: string
  stations: string[]
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
