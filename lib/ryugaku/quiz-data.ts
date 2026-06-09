// 东京留学居住人格测试 — 数据 SSOT（中文 / 主打小红书留学生）
// 设计施工图见 docs/ryugaku-quiz-design.md
import type {
  Axis,
  Question,
  BonusQuestion,
  Persona,
  HiddenPersona,
} from './types'

// ── 四个维度轴 ───────────────────────────────────────────
// code 字母顺序固定：budget · community · goal · geo（如 PCRI）
export const AXES: Axis[] = [
  {
    key: 'budget',
    emoji: '💰',
    label: '敷金礼金恐惧',
    pos: { letter: 'P', label: '省钱魂' },
    neg: { letter: 'L', label: '生活质感' },
  },
  {
    key: 'community',
    emoji: '🌶️',
    label: '老干妈半径',
    pos: { letter: 'C', label: '华人圈' },
    neg: { letter: 'J', label: '融入日本' },
  },
  {
    key: 'goal',
    emoji: '🎯',
    label: '来东京的理由',
    pos: { letter: 'R', label: '就职务实' },
    neg: { letter: 'D', label: '追梦浪漫' },
  },
  {
    key: 'geo',
    emoji: '🗺️',
    label: '地理野心',
    pos: { letter: 'I', label: '死守都心' },
    neg: { letter: 'O', label: '远郊妥协' },
  },
]

export const AXIS_ORDER = ['budget', 'community', 'goal', 'geo'] as const

// ── 20 道主轴题（每轴 5 道，正反混合防一味同意）──────────
export const QUESTIONS: Question[] = [
  // 💰 预算（+1 同意→省钱P / -1 反向同意→质感L）
  { id: 'b1', axis: 'budget', direction: 1, text: '只要房租够便宜，房子旧一点、远一点我都能忍' },
  { id: 'b2', axis: 'budget', direction: 1, text: '我研究过附近超市几点开始贴半价标签' },
  { id: 'b3', axis: 'budget', direction: 1, text: '敷金礼金保证人这些初期费用，能省一分是一分' },
  { id: 'b4', axis: 'budget', direction: -1, text: '宁可少买几件衣服，也要住得宽敞、有质感' },
  { id: 'b5', axis: 'budget', direction: -1, text: '房子是我的脸面，朋友来了不能太寒酸' },
  // 🌶️ 华人圈（+1 同意→华人圈C / -1 反向同意→融入J）
  { id: 'c1', axis: 'community', direction: 1, text: '走路 5 分钟能买到老干妈/中华食材，对我很重要' },
  { id: 'c2', axis: 'community', direction: 1, text: '房东或邻居能说中文，会让我安心很多' },
  { id: 'c3', axis: 'community', direction: 1, text: '周末和老乡吃顿火锅，比一个人逛日本超市治愈' },
  { id: 'c4', axis: 'community', direction: -1, text: '我特意躲开华人多的区，想逼自己说日语' },
  { id: 'c5', axis: 'community', direction: -1, text: '我来日本是想过日本人的生活，不是来抱团的' },
  // 🎯 目标（+1 同意→就职务实R / -1 反向同意→追梦D）
  { id: 'g1', axis: 'goal', direction: 1, text: '我留学的终极目标是在日本就职/拿身份' },
  { id: 'g2', axis: 'goal', direction: 1, text: '选房优先考虑离学校/未来公司近、通勤效率高' },
  { id: 'g3', axis: 'goal', direction: 1, text: '实习、内定、SPI 这些词我背得比谁都熟' },
  { id: 'g4', axis: 'goal', direction: -1, text: '比起就职，我更想离我热爱的东西（live/动漫/音乐）近一点' },
  { id: 'g5', axis: 'goal', direction: -1, text: '我来东京最想做的事，写进简历没用，但我就是为它来的' },
  // 🗺️ 地理（+1 同意→都心I / -1 反向同意→远郊O）
  { id: 't1', axis: 'geo', direction: 1, text: '宁可住 23 区内的 1K 小破屋，也不要埼玉的 2LDK' },
  { id: 't2', axis: 'geo', direction: 1, text: '「我住东京」这句话，住埼玉说出来我会有点心虚' },
  { id: 't3', axis: 'geo', direction: 1, text: '终电之后还能走路回家的距离，是我的底线' },
  { id: 't4', axis: 'geo', direction: -1, text: '每天通学 90 分钟没关系，电车上能补觉/背单词' },
  { id: 't5', axis: 'geo', direction: -1, text: '房子大、环境好，比地址在不在 23 区重要多了' },
]

// ── 4 道彩蛋题（主轴落型 + 这些高分 → 翻成隐藏型）────────
export const BONUS_QUESTIONS: BonusQuestion[] = [
  { id: 'x1', signal: 'pilgrim', text: '为了喜欢的人/角色，坐两小时电车去现场也值' },
  { id: 'x2', signal: 'dekasegi', text: '老实说，打工赚钱在我留学里优先级很高' },
  { id: 'x3', signal: 'serebu', text: '房租？我没仔细算过，家里会管' },
  { id: 'x4', signal: 'fukushi', text: '被问在哪个大学，我会下意识想含糊过去' },
]

// ── 16 主型（4 字母 code = budget·community·goal·geo）──────
export const PERSONAS: Persona[] = [
  // 都心 I
  { code: 'PCRI', zone: 'inner', name: '马场修行僧', slogan: '东京半径不超过山手线内侧三站，290円定食是你的米其林，日语全靠和居酒屋店长吵架', stations: ['高田马场', '新大久保', '大久保'] },
  { code: 'PCDI', zone: 'inner', name: '池袋北口の夜', slogan: '来东京第一周就找到比国内还正宗的麻辣烫，夜晚属于你和你的推し', stations: ['池袋', '要町', '东长崎'] },
  { code: 'PJRI', zone: 'inner', name: '东中野の独行侠', slogan: '你躲开华人区逼自己说日语，中央线上的东中野便宜、近都心、又不至于太喧嚣', stations: ['东中野', '中野', '落合'] },
  { code: 'PJDI', zone: 'inner', name: '高円寺の自由魂', slogan: '吉他比你的存款值钱，高円寺的二手店和 livehouse 是你的第二个学校', stations: ['高円寺', '中野', '东高円寺'] },
  { code: 'LCRI', zone: 'inner', name: '新宿の安定派', slogan: '要华人圈的方便也要体面房子，新宿御苑旁的塔楼有你妈的安全感', stations: ['新宿', '四谷', '市谷'] },
  { code: 'LCDI', zone: 'inner', name: '池袋の夜店贵族', slogan: '白天华人圈打卡，夜晚 club 追 DJ，谷子和酒一起买', stations: ['池袋', '东新宿', '新宿三丁目'] },
  { code: 'LJRI', zone: 'inner', name: '自由が丘の优等生', slogan: '过着小红书首页那种东京生活：晨跑、手冲、甜点店巡礼，务实又精致、住着有面子', stations: ['自由が丘', '都立大学', '学艺大学'] },
  { code: 'LJDI', zone: 'inner', name: '中目黑の生活方式家', slogan: '不缺钱也不将就，中目黑的精酿和唱片店，你把东京过成生活方式杂志', stations: ['中目黑', '代官山', '惠比寿'] },
  // 远郊 O
  { code: 'PCRO', zone: 'outer', name: '西川口の生活家', slogan: '「住东京」是说给国内亲戚听的，你住的是埼玉——但 2LDK 房租=同学的 1K，楼下就是华人超市，香', stations: ['西川口', '蕨', '川口'] },
  { code: 'PCDO', zone: 'outer', name: '川口の追星打工人', slogan: '白天在川口的中华料理打工，攒钱坐一小时电车去看演唱会，远但值', stations: ['川口', '西川口', '西葛西'] },
  { code: 'PJRO', zone: 'outer', name: '八王子の隐者', slogan: '严格说你在东京都，但离市中心够你看完一整季番。中央线尽头，房租自由，中央大创价大的同学懂你', stations: ['八王子', '立川', '国立'] },
  { code: 'PJDO', zone: 'outer', name: '国分寺の排练室主人', slogan: '远郊的大房子是你的排练室，房租省下的钱都进了效果器。中央线文化浓，穷得有声有色', stations: ['国分寺', '武藏小金井', '国立'] },
  { code: 'LCRO', zone: 'outer', name: '川口の定居派', slogan: '你这留学其实是来定居的——家里在川口看好了房，华人邻居一栋楼，爸妈放心，用都心一半的钱住三房', stations: ['川口', '西川口', '浦和'] },
  { code: 'LCDO', zone: 'outer', name: '江户川の移民二代', slogan: '你家早在江户川安顿好了，名义留学实则追你的二次元/音乐梦，远郊大房子装得下所有谷子和器材', stations: ['葛西', '西葛西', '浦安'] },
  { code: 'LJRO', zone: 'outer', name: '吉祥寺の理想生活家', slogan: '你来东京是为了过想象中的生活，井之头的樱花和二子玉川的河岸值这个房租（虽然你妈不知道你这月吃土）', stations: ['吉祥寺', '三鹰', '二子玉川'] },
  { code: 'LJDO', zone: 'outer', name: '国立の文艺梦想家', slogan: '你不缺钱也不凑合，选了大学城国立的樱花并木和安静，要的是文艺的留学生活，不是都心喧嚣', stations: ['国立', '国分寺', '西国分寺'] },
]

export const PERSONA_BY_CODE: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map(p => [p.code, p])
)

// ── 6 隐藏稀有型 ─────────────────────────────────────────
export const HIDDEN_PERSONAS: Record<string, HiddenPersona> = {
  pilgrim: { key: 'pilgrim', name: '圣地巡礼者', slogan: '你来东京不是为了学历，是为了能当天往返武道館，预算第一行写着「离 Zepp 近」', stations: ['有明', '新木场', '台场'] },
  otome: { key: 'otome', name: '中野乙女路の住民', slogan: '乙女路和中野百老汇是你的两个家，谷子比衣服多', stations: ['中野', '池袋', '秋叶原'] },
  serebu: { key: 'serebu', name: '港区のセレブ', slogan: '「房租」不在你的字典里，留学是 gap year，定位永远在表参道', stations: ['麻布十番', '広尾', '白金台', '南麻布'] },
  dekasegi: { key: 'dekasegi', name: '出稼ぎ战士', slogan: '「学校」是你签证上的一个词，真实课表是早晚两班；没去过迪士尼，但东京便利店报废便当时间门儿清', stations: ['西川口', '蕨', '蒲田', '川口'] },
  fukushi: { key: 'fukushi', name: '福祉大幸存者', slogan: '被问哪个大学就微微一笑转移话题——但你打工时给全宿舍最高，你比谁都懂生存', stations: ['西川口', '蕨', '北千住'] },
  nishikasai: { key: 'nishikasai', name: '西葛西の名誉インド人', slogan: '你住进了日本最大的小印度，咖喱比米饭吃得勤，邻居一半是 IT 工程师', stations: ['西葛西', '葛西'] },
}

/** 一次测试的题目总数（主轴 + 彩蛋） */
export const TOTAL_QUESTIONS = QUESTIONS.length + BONUS_QUESTIONS.length
