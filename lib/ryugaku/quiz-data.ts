// 东京留学居住人格测试 — 数据 SSOT（中文 / 主打小红书留学生）
// 文案 v2 重写稿见 docs/ryugaku-quiz-copy-v2.md（设计施工图 docs/ryugaku-quiz-design.md）
// v2 三原则：① 题目时态统一（来之前也答得了）② 每题只压一个轴 ③ 两极道德对称
// slogan = A 路线：梗在前，结尾收一拍带专属细节的真话
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
    // v2.1: 旧标签「远郊妥协」是 8 个极中唯一带道德评判的，违反两极道德对称原则，
    // 且与 outer 8 型 slogan 的主动选择叙事（国立「静けさは、贅沢だ」等）自相矛盾。
    neg: { letter: 'O', label: '远郊自在' },
  },
]

export const AXIS_ORDER = ['budget', 'community', 'goal', 'geo'] as const

// ── 20 道主轴题（每轴 5 道，正反混合防一味同意）──────────
export const QUESTIONS: Question[] = [
  // 💰 预算（+1 同意→省钱P / -1 反向同意→质感L）
  { id: 'b1', axis: 'budget', direction: 1, text: '看房时听到「礼金两个月」，我心里已经默默把这套划掉了' },
  { id: 'b2', axis: 'budget', direction: 1, text: '我是那种到哪都会先摸清超市几点贴半价标签的人' },
  { id: 'b3', axis: 'budget', direction: 1, text: '住的地方将就一点没关系，钱要花在更重要的事上' },
  { id: 'b4', axis: 'budget', direction: -1, text: '房间是我一天的开始和结束，这件事上我不想将就' },
  { id: 'b5', axis: 'budget', direction: -1, text: '我希望朋友来我家时，能由衷地说一句「住得真好」' },
  // 🌶️ 华人圈（+1 同意→华人圈C / -1 反向同意→融入J）
  { id: 'c1', axis: 'community', direction: 1, text: '走路 5 分钟能买到老干妈和中华食材，对我很重要' },
  { id: 'c2', axis: 'community', direction: 1, text: '遇到麻烦的时候，身边有能讲中文的人，我会安心很多' },
  { id: 'c3', axis: 'community', direction: 1, text: '想家的时候，日料解决不了问题，得是热气腾腾的家乡菜' },
  { id: 'c4', axis: 'community', direction: -1, text: '我有点怕自己来了日本，却一直活在中文里' },
  { id: 'c5', axis: 'community', direction: -1, text: '我憧憬的是和日本邻居寒暄、参加当地祭典的那种日常' },
  // 🎯 目标（+1 同意→就职务实R / -1 反向同意→追梦D）
  { id: 'g1', axis: 'goal', direction: 1, text: '我来日本是认真打算留下来的：工作、身份，一步步来' },
  { id: 'g2', axis: 'goal', direction: 1, text: '选学校和专业时，「好不好就职」是我的第一标准' },
  { id: 'g3', axis: 'goal', direction: 1, text: '就活、内定、签证政策这些信息，我会主动做足功课' },
  { id: 'g4', axis: 'goal', direction: -1, text: '比起为简历加分，我更想离热爱的东西近一点——live、展览、街头，什么都好' },
  { id: 'g5', axis: 'goal', direction: -1, text: '我来东京最想做的事，写进简历没用，但我就是为它来的' },
  // 🗺️ 地理（+1 同意→都心I / -1 反向同意→远郊O）
  { id: 't1', axis: 'geo', direction: 1, text: '深夜的便利店、随时有店开着的街道，这种「城市还醒着」的感觉我离不开' },
  { id: 't2', axis: 'geo', direction: 1, text: '「我住在东京」这五个字，对我来说就是有魔力' },
  { id: 't3', axis: 'geo', direction: 1, text: '我不想让「赶终电」决定我每晚几点回家' },
  { id: 't4', axis: 'geo', direction: -1, text: '每天通学 60～90 分钟我可以接受，电车上正好补觉、背单词' },
  { id: 't5', axis: 'geo', direction: -1, text: '比起市中心的热闹，我更想要推开窗能看到天空的安静' },
]

// ── 4 道彩蛋题（主轴落型 + 这些高分 → 翻成隐藏型）────────
export const BONUS_QUESTIONS: BonusQuestion[] = [
  { id: 'x1', signal: 'pilgrim', text: '只要现场有我喜欢的人或作品，跨城跑一趟根本不算事' },
  { id: 'x2', signal: 'dekasegi', text: '学费和生活费，我打算大部分靠自己挣' },
  { id: 'x3', signal: 'serebu', text: '房租？我没仔细算过，家里会管' },
  { id: 'x4', signal: 'fukushi', text: '比起学校的名气，我更在意这张签证能让我过上什么日子' },
]

// ── 配色（MBTI 式四大色族 = community × goal，P/L·I/O 取同族色阶）──
// 朱红族 C×R（华人圈×务实·烟火气） 紫粉族 C×D（华人圈×追梦·夜与光）
// 蓝族   J×R（融入×务实·端正）     绿族   J×D（融入×追梦·自由文艺）
// 隐藏型各自独立色。所有色在 cream 背景上保证文字对比度。

// ── 16 主型（4 字母 code = budget·community·goal·geo）──────
// 车站规则：全表零重叠（含次要槽），每站唯一归属（docs/ryugaku-quiz-copy-v2.md 车站总表）
export const PERSONAS: Persona[] = [
  // 都心 I
  { code: 'PCRI', zone: 'inner', name: '马场修行僧', nameJa: '東京、修行中。', color: '#a8332b', slogan: '东京半径不超过山手线内侧三站，290円定食是你的米其林，日语全靠和居酒屋店长吵架练出来。日子过得紧，但你比谁都清楚自己为什么来。', stations: ['高田马场', '新大久保', '大久保'], stationKeys: ['高田馬場', '新大久保', '大久保(東京)'] },
  { code: 'PCDI', zone: 'inner', name: '池袋夜行者', nameJa: '夜はこれからだ。', color: '#7b3b8f', slogan: '来东京第一周就找到了比国内还正宗的麻辣烫，白天上课打工，夜晚属于北口的霓虹和你的推し。一个人的城市再大，有热汤和热爱，就不算漂着。', stations: ['池袋', '要町', '东长崎'], stationKeys: ['池袋', '要町', '東長崎'] },
  { code: 'PJRI', zone: 'inner', name: '东中野独行侠', nameJa: '群れない、ブレない。', color: '#2f5d8a', slogan: '你特意绕开了华人扎堆的区，中央线上的东中野便宜、安静、十分钟到新宿。一个人吃饭、一个人办手续、一个人变强——孤独是你自己选的修炼场。', stations: ['东中野', '落合', '中野坂上'], stationKeys: ['東中野', '落合(東京)', '中野坂上'] },
  { code: 'PJDI', zone: 'inner', name: '高円寺浪人', nameJa: '音を出せる場所が、家。', color: '#557a46', slogan: '吉他比存款值钱，高円寺的二手店和 livehouse 是你的第二个学校。别人问你图什么，你说不清——但调音的那几秒，你比谁都笃定。', stations: ['高円寺', '东高円寺', '阿佐ヶ谷'], stationKeys: ['高円寺', '東高円寺', '阿佐ケ谷'] },
  { code: 'LCRI', zone: 'inner', name: '新宿体面人', nameJa: 'ちゃんと暮らすって、最強。', color: '#8f2e4c', slogan: '要华人圈的方便，也要拿得出手的房子，新宿御苑旁的塔楼是你给爸妈的定心丸。把日子过稳不是没野心——稳，就是你的野心。', stations: ['新宿', '四谷', '市谷'], stationKeys: ['新宿', '四ツ谷(四ッ谷)', '市ケ谷(市ヶ谷)'] },
  { code: 'LCDI', zone: 'inner', name: '夜店贵族', nameJa: '今夜も、フロアが呼んでる。', color: '#5b2a86', slogan: '白天在华人街吃饱喝足，晚上钻进歌舞伎町的声浪里，谷子和酒从来都是一起买。玩得最疯的人，分寸感其实最好——你心里有条不会越过的线。', stations: ['西武新宿', '东新宿', '新宿三丁目'], stationKeys: ['西武新宿', '東新宿', '新宿三丁目'] },
  { code: 'LJRI', zone: 'inner', name: '自由之丘优等生', nameJa: '丁寧な暮らし、本気でやってる。', color: '#1f7a8c', slogan: '晨跑、手冲、甜点店巡礼，你过着小红书首页那种东京生活。没人看见的是：把生活过成范本，背后是你从不松懈的自律。', stations: ['自由が丘', '都立大学', '学艺大学'], stationKeys: ['自由が丘', '都立大学', '学芸大学'] },
  { code: 'LJDI', zone: 'inner', name: '中目黑主理人', nameJa: '暮らしを、作品に。', color: '#2f6e5a', slogan: '中目黑的精酿、代官山的唱片店、目黑川的樱花，你把东京过成了生活方式杂志。只是杂志不会写：把日子过成想要的样子，你私下有多认真。', stations: ['中目黑', '代官山', '惠比寿'], stationKeys: ['中目黒', '代官山', '恵比寿'] },
  // 远郊 O
  { code: 'PCRO', zone: 'outer', name: '西川口精算师', nameJa: '家賃は埼玉、生活は無敵。', color: '#b5552d', slogan: '住址写着埼玉，被同学笑远——但你的 2LDK 放得下双人床和整个生活，他们的 1K 不行。楼下就是华人超市，你早就算清了：体面给别人看，实惠留给自己。', stations: ['西川口', '蕨', '南浦和'], stationKeys: ['西川口', '蕨', '南浦和'] },
  { code: 'PCDO', zone: 'outer', name: '西船桥追光者', nameJa: 'ライトが灯る、その一瞬のために。', color: '#b5485d', slogan: '白天在船桥的中华料理店端盘子，晚上一班京叶线直达幕张的场馆。别人看你辛苦，可灯亮起来那一秒，你知道这一切都值。', stations: ['西船桥', '新小岩', '龟户'], stationKeys: ['西船橋', '新小岩', '亀戸'] },
  { code: 'PJRO', zone: 'outer', name: '八王子隐士', nameJa: '東京、ほどよく遠い。', color: '#4a6d8c', slogan: '严格来说你在东京都，但离市中心够看完一整季番。房租自由、空气便宜，中央线尽头的安静里，你把自己的节奏守得很好。', stations: ['八王子', '立川', '日野'], stationKeys: ['八王子', '立川', '日野(東京)'] },
  { code: 'PJDO', zone: 'outer', name: '国分寺造音师', nameJa: '音量だけは、譲れない。', color: '#6b7d3a', slogan: '远郊的大房间是你的排练室，房租省下来的钱全进了效果器。穷得有声有色不是自嘲——是你真的在用全部预算，养活一个声音。', stations: ['国分寺', '武藏小金井', '东小金井'], stationKeys: ['国分寺', '武蔵小金井', '東小金井'] },
  { code: 'LCRO', zone: 'outer', name: '川口业主', nameJa: '留学のち、永住。', color: '#7d3a2e', slogan: '别人在看房，你家在买房。华人邻居一栋楼，爸妈隔着时差也放心，用都心一半的钱住三个房间。你的留学没有倒计时——因为你来，就没打算走。', stations: ['川口', '东川口', '浦和'], stationKeys: ['川口', '東川口', '浦和'] },
  { code: 'LCDO', zone: 'outer', name: '江户川本地人', nameJa: '留学生のフリした、地元民。', color: '#9c4f78', slogan: '你家早就在江户川安顿好了，签证写着留学，生活过得像本地人。大房子装得下所有谷子和器材——家人把后方守住了，你只管去追你的东西。', stations: ['船堀', '一之江', '浦安'], stationKeys: ['船堀', '一之江', '浦安(千葉)'] },
  { code: 'LJRO', zone: 'outer', name: '吉祥寺理想家', nameJa: '憧れの暮らしに、家賃を払う。', color: '#3a6ea5', slogan: '井之头公园的樱花、周末的杂货店巡礼，你来东京就是为了过想象中的生活。这份房租买的不是地段，是每天睁眼那句：对，这就是我要的日子。', stations: ['吉祥寺', '三鹰', '二子玉川'], stationKeys: ['吉祥寺', '三鷹', '二子玉川'] },
  { code: 'LJDO', zone: 'outer', name: '国立慢生活家', nameJa: '静けさは、贅沢だ。', color: '#5f7350', slogan: '你不缺钱，却选了大学城的樱花并木和安静。都心的热闹你随时可以去，但你早想明白了：留学这几年，最贵的不是地段，是不被打扰的时间。', stations: ['国立', '西国分寺', '武藏境'], stationKeys: ['国立', '西国分寺', '武蔵境'] },
]

export const PERSONA_BY_CODE: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map(p => [p.code, p])
)

// ── 6 隐藏稀有型 ─────────────────────────────────────────
export const HIDDEN_PERSONAS: Record<string, HiddenPersona> = {
  pilgrim: { key: 'pilgrim', name: '圣地巡礼者', nameJa: '現場がすべて。', color: '#4f46a5', slogan: '你来东京不是为了学历，是为了能当天往返武道馆，租房条件第一行写着「离 Zepp 近」。机票钱省了，眼泪没省——能随时奔赴热爱的人生，你等这一天很久了。', stations: ['有明', '新木场', '台场'], stationKeys: ['有明(東京)', '新木場', '台場'] },
  otome: { key: 'otome', name: '中野乙女', nameJa: '推しは推せる時に推せ。', color: '#c2557f', slogan: '乙女路和中野百老汇是你的两个家，谷子比衣服多，痛包比书包重。别人不懂这些塑料小人有什么好——但被纸片人救过的日子，你记得一清二楚。', stations: ['中野', '东池袋', '秋叶原'], stationKeys: ['中野(東京)', '東池袋', '秋葉原'] },
  serebu: { key: 'serebu', name: '港区名流', nameJa: '家賃という概念がない。', color: '#9c7c2f', slogan: '房租多少你真没概念，留学更像一场 gap year，定位永远在表参道。凡尔赛归凡尔赛——独自在异国把日子过得漂亮，也是一种本事。', stations: ['麻布十番', '広尾', '白金台'], stationKeys: ['麻布十番', '広尾', '白金台'] },
  dekasegi: { key: 'dekasegi', name: '蒲田打工战神', nameJa: '始発も終電も、戦友だ。', color: '#3d4f63', slogan: '「学校」是签证上的一个词，真实课表是早晚两班；没去过迪士尼，但每家便利店的报废时间你门儿清。这座城市最早和最晚的电车上都有你——东京没几个人比你更拼。', stations: ['蒲田', '杂色', '大鸟居'], stationKeys: ['蒲田', '雑色', '大鳥居'] },
  fukushi: { key: 'fukushi', name: '福祉大幸存者', nameJa: '学歴より、生き抜く力。', color: '#5d7052', slogan: '被问哪个大学，你微微一笑转移话题。但全宿舍打工时给最高的是你，最先摸清役所手续的也是你——学历会过期，活下去的本事不会。', stations: ['赤羽', '王子', '十条'], stationKeys: ['赤羽', '王子', '十条(東京)'] },
  nishikasai: { key: 'nishikasai', name: '西葛西咖喱党', nameJa: '気づけば、カレーが主食。', color: '#b07820', slogan: '一不小心住进了日本最大的小印度，邻居一半是 IT 工程师，咖喱吃得比米饭勤。误打误撞的缘分，你倒处得挺香——把意外住成日常，本来就是你的超能力。', stations: ['西葛西', '葛西'], stationKeys: ['西葛西', '葛西'] },
}

/** 一次测试的题目总数（主轴 + 彩蛋） */
export const TOTAL_QUESTIONS = QUESTIONS.length + BONUS_QUESTIONS.length
