// 全駅の市区町村を国土地理院（GSI）逆ジオコーダで解決する。
// 入力: public/data/stations.geojson（座標）
// 出力: public/data/station_muni.json  { "<code>": { muniCd, pref, city } }
//
// 用途: /area/{ward} hub（站頁工程）の駅⇔区市紐付け。station.csv（別マシン）に
// 依存せず座標から再現可能。実行: node scripts/build_station_muni.mjs
// 注意: 社内 proxy 環境では TLS 検証を無効化している（一次データ生成のみ）。
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import fs from 'node:fs'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const OUT = 'public/data/station_muni.json'

// muniCd → [都道府県, 市区町村] 対応表は GSI 公式 muni.js から取得
const muniJs = await fetch('https://maps.gsi.go.jp/js/muni.js').then(r => r.text())
const MUNI = {}
for (const m of muniJs.matchAll(/\["(\d+)"\]\s*=\s*'([^']+)'/g)) {
  const [, cd, val] = m
  const parts = val.split(',') // 例: 13,東京都,13104,新宿区
  if (parts.length === 4) MUNI[cd] = { pref: parts[1], city: parts[3] }
}
console.log('muni table:', Object.keys(MUNI).length)

const geo = JSON.parse(fs.readFileSync('public/data/stations.geojson', 'utf8'))
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}

let done = 0
for (const f of geo.features) {
  const code = f.properties.code
  if (out[code]?.muniCd) { done++; continue }
  const [lon, lat] = f.geometry.coordinates
  let rec = null
  for (let i = 0; i < 3 && !rec; i++) {
    try {
      const j = await fetch(
        `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`,
        { headers: { 'User-Agent': 'kayoha-build/1.0' } },
      ).then(r => r.json())
      const cd = j?.results?.muniCd
      if (cd) {
        // muni.js のキーは先頭ゼロ無し（例 "13104"）。GSI 応答も同形式
        const m = MUNI[cd] ?? MUNI[String(parseInt(cd, 10))]
        rec = { muniCd: cd, pref: m?.pref ?? null, city: m?.city ?? null }
      }
    } catch {
      await sleep(3000 * (i + 1))
    }
  }
  out[code] = rec ?? { muniCd: null, pref: null, city: null }
  done++
  if (done % 100 === 0) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log(`${done}/${geo.features.length}`) }
  await sleep(120)
}
fs.writeFileSync(OUT, JSON.stringify(out))
const miss = Object.values(out).filter(v => !v.city).length
console.log(`done. total=${Object.keys(out).length} unresolved=${miss}`)
