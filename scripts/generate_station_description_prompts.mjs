/**
 * 駅ページ編集文（150-250 字）の batch prompt 生成スクリプト
 *
 * docs/station-pages-design.md §2-4「街の特徴」用。
 * area_features の 50-75 字を種文に、首批 150 駅分を 6 batch × 25 駅で生成する。
 *
 * 入力:
 *   docs/research/station-batch1-candidates.json  … 150 駅（code/name/slug/lines）
 *   public/data/stations.geojson                  … min_to_shinjuku
 *   public/data/station_muni.json                 … 都県・市区
 *   public/data/station_government_rent.json      … 家賃（円/月、文脈参考用）
 *   public/data/area_features.json                … 種文（駅名キー）
 *
 * 出力:
 *   _handoff/station_desc_prompts/batch_NN.md     … LLM 向け prompt
 *   _handoff/station_desc_responses/              … 応答 JSON の置き場（空作成）
 *
 * 応答が揃ったら: python scripts/merge_station_description_responses.py
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf-8'))

const BATCH_SIZE = 25
const PREF_ORDER = ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県', '山梨県']

const candidates = read('docs/research/station-batch1-candidates.json')
const geo = read('public/data/stations.geojson')
const muni = read('public/data/station_muni.json').stations ?? read('public/data/station_muni.json')
const gov = read('public/data/station_government_rent.json').stations
const seeds = read('public/data/area_features.json').stations

const minShinjuku = {}
for (const f of geo.features) minShinjuku[f.properties.code] = f.properties.min_to_shinjuku ?? null

// 表示名 = 消歧後缀（丸/半角括弧）を除いた駅名
const displayName = name => name.replace(/[（(].*$/, '')

const stations = candidates.map(c => {
  const m = muni[String(c.code)]
  const rent = gov[String(c.code)]
  const seed = seeds[c.name]
  if (!m || !seed) throw new Error(`missing muni/seed for ${c.name} (${c.code})`)
  return {
    key: c.name,
    display: displayName(c.name),
    lines: c.lines,
    pref: m.pref,
    city: m.city,
    min: minShinjuku[c.code],
    rentMan: rent ? (rent / 10000).toFixed(1) : null,
    seed,
  }
})

// 同じ batch に同じ都県・近い距離帯を寄せる（文脈を保ちやすい）
stations.sort((a, b) => {
  const pa = PREF_ORDER.indexOf(a.pref), pb = PREF_ORDER.indexOf(b.pref)
  if (pa !== pb) return pa - pb
  return (a.min ?? 999) - (b.min ?? 999)
})

const HEADER = `# あなたの役割（必ず守ってください）

あなたは関東の街と住宅事情に詳しい編集ライターです。通勤時間マップサービス「Kayoha」の駅別ページにある「{駅名}駅周辺はどんな街か」セクションの本文を執筆します。読者はその駅への引っ越しを検討している人です。

## 執筆ルール

1. 各駅 **150〜250 文字**、改行なしの 1 段落、です・ます調。
2. 下の「種文」の事実を核に、あなたが確実に知っている知識（商店街・ランドマーク・街の雰囲気・住宅事情・どんな人に向くか）で肉付けしてください。
3. **具体的な所要分数・家賃金額は本文に書かない**こと（ページ内の自動データ表と矛盾しうるため）。「新宿へ出やすい」「家賃は都心より抑えめ」等の定性表現は可。各駅に添えた分数・家賃は文脈理解のための参考データです。
4. 不確かな固有名詞、年号、再開発の完成時期などは書かない。「魅力満載」「注目のエリア」のような誇大広告調も禁止。
5. 書き出しのパターンは駅ごとに変えること。「〜駅周辺は」「〜は」のような駅名始まりの本文はこの batch 内で 3 件まで。
6. 空港・工場地帯・山間部・観光特化など居住向けでない駅は、無理に住みやすさを語らず、駅と周辺の実態を正直に書く（例: 見学目的で訪れる駅、ベッドタウンの玄関口、など）。
7. 出力は**コードフェンスや前置きを付けない純粋な JSON** で、形式は \`{"stations": {"<キー>": "<本文>", ...}}\`。キーは各駅の「キー:」の値を一字一句そのまま使うこと（括弧付き消歧サフィックスも含む）。

## 文体サンプル（このリストには含まれない駅の例）

高円寺の例（約 220 字）:
古着屋とライブハウスが軒を連ねる、若者文化の色濃い街です。純情商店街やパル商店街など昔ながらのアーケードが駅前から延び、個人経営の飲食店や銭湯も健在。毎年夏の阿波おどりには大勢の人出があります。中央線で新宿方面へのアクセスが良い割に家賃は比較的手頃で、音楽や古着が好きな一人暮らしの若者に長年支持されてきました。駅から離れると静かな住宅街が広がり、緑の多い公園も点在します。

---
`

mkdirSync(path.join(ROOT, '_handoff/station_desc_prompts'), { recursive: true })
mkdirSync(path.join(ROOT, '_handoff/station_desc_responses'), { recursive: true })

const batches = []
for (let i = 0; i < stations.length; i += BATCH_SIZE) batches.push(stations.slice(i, i + BATCH_SIZE))

batches.forEach((batch, idx) => {
  const n = idx + 1
  const parts = [HEADER]
  parts.push(`# Batch ${n} / ${batches.length}（${batch.length} 駅）\n`)
  parts.push(`以下 ${batch.length} 駅それぞれについて本文を書いてください。\n`)
  for (const s of batch) {
    parts.push(`- キー: ${s.key}`)
    parts.push(`  駅名: ${s.display} ／ 路線: ${s.lines.join('・')} ／ 所在: ${s.pref}${s.city}`)
    const ref = []
    ref.push(s.min != null ? `新宿まで約${s.min}分` : '新宿まで鉄道到達データなし')
    if (s.rentMan) ref.push(`家賃参考 ${s.rentMan}万円/月`)
    parts.push(`  参考データ: ${ref.join('、')}`)
    parts.push(`  種文: ${s.seed}`)
    parts.push('')
  }
  parts.push(`全 ${batch.length} 駅分を漏れなく含む JSON オブジェクトだけを出力してください。`)
  const file = path.join(ROOT, `_handoff/station_desc_prompts/batch_${String(n).padStart(2, '0')}.md`)
  writeFileSync(file, parts.join('\n'), 'utf-8')
  console.log(`wrote ${path.relative(ROOT, file)} (${batch.length} stations)`)
})
console.log(`done: ${batches.length} batches, ${stations.length} stations`)
