/**
 * 駅ページ（/st/{slug}）・区市 hub（/area/{slug}）共用のデータ層。
 * server component 専用（node:fs）。SSG ビルド時に一度だけ全データを組み立てる。
 *
 * SSOT:
 * - 対象駅: public/data/station_page_batches.json（batch1 = 需要実測 top150、
 *   docs/research/station-demand-analysis-2026-06.md の門控分批）
 * - slug:   public/data/station_slugs.json（1831 全駅、唯一性保証）
 * - 区市:   public/data/station_muni.json（GSI 逆ジオコーダ産、scripts/build_station_muni.mjs）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { DESTINATIONS_META } from '@/lib/destinations'
import { WARDS, wardOfCity, type WardMeta } from './wards'

const read = async (rel: string) =>
  JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/data', rel), 'utf-8'))

export type CommuteEntry = {
  slug: string
  /** 目的地表示名（例「新宿」） */
  name: string
  minutes: number
  transfers: number | null
}

export type NearStation = {
  code: number
  name: string
  slug: string
  /** 隣駅: 直結エッジの所要分 / 似た駅: null */
  minutes: number | null
  hasPage: boolean
}

export type StationPage = {
  code: number
  /** geojson 正規名（消歧後缀付き、地図 deep link 用） */
  name: string
  /** UI 表示名（消歧後缀除去、「中野(東京)」→「中野」） */
  displayName: string
  nameEn: string
  slug: string
  lat: number
  lon: number
  lines: string[]
  muni: { pref: string | null; city: string | null }
  ward: WardMeta | null
  /** 30 通勤地への実算所要時間（昇順） */
  commutes: CommuteEntry[]
  /** 政府統計家賃（円/月、無い駅は null） */
  govRent: number | null
  /** SUUMO 間取り別相場（万円、101 駅のみ） */
  suumoRent: Record<string, number> | null
  /** 編集性本文 150-250 字（station_descriptions.json、未生成は null） */
  description: string | null
  /** area_features 50-75 字（seed / fallback 表示用） */
  feature: string | null
  neighbors: NearStation[]
  similar: NearStation[]
}

export type WardPage = WardMeta & {
  stations: StationPage[]
  /** hub 配下で頁を持つ駅数 */
  pageCount: number
  /** 冒頭リード文 200-300 字（ward_descriptions.json、未生成は null） */
  description: string | null
}

type Bundle = {
  /** batch 順（需要順）の頁対象駅 */
  list: StationPage[]
  bySlug: Record<string, StationPage>
  wards: WardPage[]
  wardBySlug: Record<string, WardPage>
  /** データ基準日（表・sitemap lastmod 用） */
  dataDate: string
}

export const loadStationPages = cache(async (): Promise<Bundle> => {
  const [geo, slugs, batches, muni, gov, manual, features, descriptions, wardDescs, graph] =
    await Promise.all([
      read('stations.geojson'),
      read('station_slugs.json'),
      read('station_page_batches.json'),
      read('station_muni.json'),
      read('station_government_rent.json'),
      read('manual_rent_data.json'),
      read('area_features.json'),
      read('station_descriptions.json'),
      read('ward_descriptions.json'),
      read('graph.json'),
    ])

  const batchCodes: number[] = batches.batch1
  const batchSet = new Set(batchCodes)

  // 全駅 props（隣駅は頁の有無に関わらず名前が要る）
  type Props = Record<string, unknown> & { code: number; name: string; name_en: string }
  const propsByCode = new Map<number, { p: Props; lat: number; lon: number }>()
  for (const f of geo.features) {
    propsByCode.set(f.properties.code, {
      p: f.properties,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    })
  }

  // 隣接表（graph エッジ、双方向、同一相手は最短分のみ）
  const adj = new Map<number, Map<number, number>>()
  const addEdge = (a: number, b: number, t: number) => {
    if (!adj.has(a)) adj.set(a, new Map())
    const m = adj.get(a)!
    m.set(b, Math.min(m.get(b) ?? Infinity, t))
  }
  for (const e of graph.edges as { a: number; b: number; t: number }[]) {
    addEdge(e.a, e.b, e.t)
    addEdge(e.b, e.a, e.t)
  }

  const buildBase = (code: number): StationPage | null => {
    const rec = propsByCode.get(code)
    if (!rec) return null
    const { p, lat, lon } = rec
    const m = muni[String(code)] ?? { pref: null, city: null }
    const commutes: CommuteEntry[] = DESTINATIONS_META.map(d => ({
      slug: d.slug,
      name: d.displayName,
      minutes: p[`min_to_${d.slug}`] as number,
      transfers: (p[`transfers_to_${d.slug}`] as number | undefined) ?? null,
    }))
      .filter(c => typeof c.minutes === 'number')
      .sort((a, b) => a.minutes - b.minutes)
    return {
      code,
      name: p.name,
      displayName: p.name.replace(/[(（][^)）]+[)）]$/, ''),
      nameEn: p.name_en,
      slug: slugs[String(code)].slug,
      lat,
      lon,
      lines: (p.line_names as string[]) ?? [],
      muni: { pref: m.pref, city: m.city },
      ward: wardOfCity(m.city),
      commutes,
      govRent: gov.stations[String(code)] ?? null,
      suumoRent: manual.stations[p.name] ?? null,
      description: descriptions.stations[p.name] ?? null,
      feature: features.stations[p.name] ?? null,
      neighbors: [],
      similar: [],
    }
  }

  const list = batchCodes
    .map(buildBase)
    .filter((s): s is StationPage => s !== null)
  const byCode = new Map(list.map(s => [s.code, s]))

  // 隣駅: 直結エッジの近い順 4 件（頁が無い駅も表示、リンクは頁持ちのみ）
  for (const s of list) {
    const edges = [...(adj.get(s.code) ?? [])]
      .filter(([other]) => propsByCode.has(other))
      .sort((a, b) => a[1] - b[1])
      .slice(0, 4)
    s.neighbors = edges.map(([other, t]) => ({
      code: other,
      name: propsByCode.get(other)!.p.name.replace(/[(（][^)）]+[)）]$/, ''),
      slug: slugs[String(other)].slug,
      minutes: t,
      hasPage: batchSet.has(other),
    }))
  }

  // 似た駅: batch 内で通勤プロファイル + 家賃が近い 5 駅（隣駅と重複除外）
  for (const s of list) {
    const neighborCodes = new Set(s.neighbors.map(n => n.code))
    const scored = list
      .filter(o => o.code !== s.code && !neighborCodes.has(o.code))
      .map(o => {
        let d = 0
        let n = 0
        for (let i = 0; i < s.commutes.length; i++) {
          const mine = s.commutes[i]
          const theirs = o.commutes.find(c => c.slug === mine.slug)
          if (!theirs) continue
          d += Math.abs(mine.minutes - theirs.minutes)
          n++
        }
        const commuteDist = n ? d / n : Infinity
        const rentDist =
          s.govRent && o.govRent ? Math.abs(s.govRent - o.govRent) / 10000 : 2
        return { o, score: commuteDist + rentDist * 2 }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
    s.similar = scored.map(({ o }) => ({
      code: o.code,
      name: o.displayName,
      slug: o.slug,
      minutes: null,
      hasPage: true,
    }))
  }

  // 区市 hub: 配下に頁持ち駅が 1 つ以上ある hub のみ生成
  const wards: WardPage[] = WARDS.map(w => {
    const stations = list.filter(s => s.ward?.slug === w.slug)
    return {
      ...w,
      stations,
      pageCount: stations.length,
      description: wardDescs.wards[w.slug] ?? null,
    }
  }).filter(w => w.pageCount > 0)

  return {
    list,
    bySlug: Object.fromEntries(list.map(s => [s.slug, s])),
    wards,
    wardBySlug: Object.fromEntries(wards.map(w => [w.slug, w])),
    dataDate: manual._meta?.data_base_date ?? '2026-04-13',
  }
})
