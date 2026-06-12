/**
 * 区市 hub（/area/{ward}）の編集文 200-300 字の batch prompt 生成スクリプト
 *
 * docs/station-pages-design.md §3。首批 150 駅が属する hub（34 前後）のみ対象
 * （lib/station-pages/data.ts と同じ「頁持ち駅 ≥1」フィルタ）。
 *
 * 出力:
 *   _handoff/ward_desc_prompts/batch_NN.md
 *   _handoff/ward_desc_responses/                … 応答 JSON 置き場
 *
 * 応答が揃ったら: python scripts/merge_ward_description_responses.py
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf-8'))

const BATCH_SIZE = 17

// wards.ts と同じ 39 自治体 SSOT（政令市は前方一致）。mjs から TS を import
// できないため、name/pref/isSeirei だけ複製。slug は wards.ts が SSOT。
const WARDS = [
  ['chiyoda-ku', '千代田区', '東京都'], ['chuo-ku', '中央区', '東京都'], ['minato-ku', '港区', '東京都'],
  ['shinjuku-ku', '新宿区', '東京都'], ['bunkyo-ku', '文京区', '東京都'], ['taito-ku', '台東区', '東京都'],
  ['sumida-ku', '墨田区', '東京都'], ['koto-ku', '江東区', '東京都'], ['shinagawa-ku', '品川区', '東京都'],
  ['meguro-ku', '目黒区', '東京都'], ['ota-ku', '大田区', '東京都'], ['setagaya-ku', '世田谷区', '東京都'],
  ['shibuya-ku', '渋谷区', '東京都'], ['nakano-ku', '中野区', '東京都'], ['suginami-ku', '杉並区', '東京都'],
  ['toshima-ku', '豊島区', '東京都'], ['kita-ku', '北区', '東京都'], ['arakawa-ku', '荒川区', '東京都'],
  ['itabashi-ku', '板橋区', '東京都'], ['nerima-ku', '練馬区', '東京都'], ['adachi-ku', '足立区', '東京都'],
  ['katsushika-ku', '葛飾区', '東京都'], ['edogawa-ku', '江戸川区', '東京都'],
  ['musashino-shi', '武蔵野市', '東京都'], ['mitaka-shi', '三鷹市', '東京都'], ['chofu-shi', '調布市', '東京都'],
  ['fuchu-shi', '府中市', '東京都'], ['hachioji-shi', '八王子市', '東京都'], ['tachikawa-shi', '立川市', '東京都'],
  ['kokubunji-shi', '国分寺市', '東京都'], ['machida-shi', '町田市', '東京都'],
  ['kawasaki-shi', '川崎市', '神奈川県', true], ['yokohama-shi', '横浜市', '神奈川県', true],
  ['saitama-shi', 'さいたま市', '埼玉県', true], ['kawaguchi-shi', '川口市', '埼玉県'],
  ['funabashi-shi', '船橋市', '千葉県'], ['ichikawa-shi', '市川市', '千葉県'],
  ['matsudo-shi', '松戸市', '千葉県'], ['urayasu-shi', '浦安市', '千葉県'],
]

const candidates = read('docs/research/station-batch1-candidates.json')
const muni = read('public/data/station_muni.json').stations ?? read('public/data/station_muni.json')

const displayName = name => name.replace(/[（(].*$/, '')

const wardStations = new Map() // slug -> [{name, views}]
for (const c of candidates) {
  const m = muni[String(c.code)]
  if (!m) continue
  const hit = WARDS.find(([, name, , seirei]) =>
    seirei ? (m.city ?? '').startsWith(name) : m.city === name)
  if (!hit) continue
  const slug = hit[0]
  if (!wardStations.has(slug)) wardStations.set(slug, [])
  wardStations.get(slug).push({ name: displayName(c.name), views: c.views })
}

const wards = WARDS.filter(([slug]) => wardStations.has(slug)).map(([slug, name, pref]) => ({
  slug, name, pref,
  stations: wardStations.get(slug).sort((a, b) => b.views - a.views).map(s => s.name),
}))
console.log(`wards with batch1 stations: ${wards.length}`)

const HEADER = `# あなたの役割（必ず守ってください）

あなたは関東の街と住宅事情に詳しい編集ライターです。通勤時間マップサービス「Kayoha」の区市別ページ（{区市名}の住みやすさ・家賃相場）の冒頭リード文を執筆します。読者はその区市への引っ越しを検討している人です。

## 執筆ルール

1. 各区市 **200〜300 文字**、改行なしの 1 段落、です・ます調。
2. 区市レベルの性格を書く: 全体の雰囲気・主要エリアの違い（例: 駅前繁華 vs 住宅地）・住環境・家賃の定性的な水準感・どんな人に向くか。掲載駅（参考に列挙）に軽く触れてよいが、駅個別の詳細は書かない（各駅ページが担当）。
3. **具体的な所要分数・家賃金額・人口などの数値は書かない**（ページ内の自動データ表と矛盾しうるため）。「都心に出やすい」「家賃は23区内では抑えめ」等の定性表現は可。
4. 不確かな固有名詞、年号、再開発の完成時期などは書かない。「魅力満載」「注目のエリア」のような誇大広告調も禁止。
5. 書き出しのパターンは区市ごとに変えること。「〜区は」「〜市は」のような名前始まりの本文はこの batch 内で 3 件まで。
6. 出力は**コードフェンスや前置きを付けない純粋な JSON** で、形式は \`{"wards": {"<slug>": "<本文>", ...}}\`。キーは各区市の「slug:」の値をそのまま使うこと。

## 文体サンプル（約 250 字、このリストにない例: 国立市）

一橋大学を中心に発展した学園都市で、駅から南へまっすぐ延びる大学通りの並木道が街の象徴です。文教地区指定によりパチンコ店などの出店が制限されており、落ち着いた住宅街が保たれています。中央線で都心へ通勤しやすい一方、買い物は隣の立川に頼る場面もあります。家賃は多摩地域としてはやや高めですが、治安と教育環境を重視する子育て世帯や、静かな環境で暮らしたい単身者に長く支持されてきました。休日は谷保天満宮や城山公園など、緑に触れられる場所も身近にあります。

---
`

mkdirSync(path.join(ROOT, '_handoff/ward_desc_prompts'), { recursive: true })
mkdirSync(path.join(ROOT, '_handoff/ward_desc_responses'), { recursive: true })

const batches = []
for (let i = 0; i < wards.length; i += BATCH_SIZE) batches.push(wards.slice(i, i + BATCH_SIZE))

batches.forEach((batch, idx) => {
  const n = idx + 1
  const parts = [HEADER]
  parts.push(`# Batch ${n} / ${batches.length}（${batch.length} 区市）\n`)
  parts.push(`以下 ${batch.length} 区市それぞれについてリード文を書いてください。\n`)
  for (const w of batch) {
    parts.push(`- slug: ${w.slug}`)
    parts.push(`  区市名: ${w.pref}${w.name}`)
    parts.push(`  掲載駅（需要順・参考）: ${w.stations.join('、')}`)
    parts.push('')
  }
  parts.push(`全 ${batch.length} 区市分を漏れなく含む JSON オブジェクトだけを出力してください。`)
  const file = path.join(ROOT, `_handoff/ward_desc_prompts/batch_${String(n).padStart(2, '0')}.md`)
  writeFileSync(file, parts.join('\n'), 'utf-8')
  console.log(`wrote ${path.relative(ROOT, file)} (${batch.length} wards)`)
})
