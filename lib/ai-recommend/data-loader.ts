/**
 * AI 推薦 Route Handler 用、server-side でデータを load + module キャッシュ。
 *
 * 読込: public/data/{stations.geojson, station_pref.json, manual_rent_data.json,
 *                    station_government_rent.json}
 * キャッシュ: module-level、初回 request で lazy load、以降再利用。
 * Vercel serverless function でも process.cwd() 経由で public/ にアクセス可能。
 */

import { readFile } from 'fs/promises'
import path from 'path'

interface StationCommute {
  min:       number
  transfers: number
}

export interface ServerStation {
  code:   number
  name:   string
  lat:    number
  lon:    number
  pref:   string                                  // 「東京都」「神奈川県」等
  lines:  string[]                                // 主要路線（line_names）
  commute: Record<string, StationCommute>         // destination slug → {min, transfers}
}

interface RentRow {
  '1R':   number | null
  '1K':   number | null
  '1DK':  number | null
  '1LDK': number | null
  '2LDK': number | null
  '3LDK': number | null
}

export interface ServerStationData {
  stations:       Record<number, ServerStation>
  manualRent:     Record<string, RentRow>     // 駅名 → SUUMO 6 間取り原データ（5 分相場）
  governmentRent: Record<string, number>      // station_code (string) → 月家賃 円
}

let cached: ServerStationData | null = null

export async function loadServerStationData(): Promise<ServerStationData> {
  if (cached) return cached

  const dataDir = path.join(process.cwd(), 'public', 'data')
  const [geojson, prefMap, manualRent, govRent] = await Promise.all([
    readFile(path.join(dataDir, 'stations.geojson'),              'utf-8').then(JSON.parse),
    readFile(path.join(dataDir, 'station_pref.json'),             'utf-8').then(JSON.parse),
    readFile(path.join(dataDir, 'manual_rent_data.json'),         'utf-8').then(JSON.parse),
    readFile(path.join(dataDir, 'station_government_rent.json'),  'utf-8').then(JSON.parse),
  ])

  const stations: Record<number, ServerStation> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const feat of geojson.features as any[]) {
    const p = feat.properties
    const code = p.code as number
    const commute: Record<string, StationCommute> = {}
    for (const key of Object.keys(p)) {
      if (!key.startsWith('min_to_')) continue
      const dest = key.slice('min_to_'.length)
      commute[dest] = {
        min:       p[key],
        transfers: p[`transfers_to_${dest}`] ?? 0,
      }
    }
    stations[code] = {
      code,
      name:   p.name,
      lat:    feat.geometry.coordinates[1],
      lon:    feat.geometry.coordinates[0],
      pref:   prefMap[String(code)] ?? '不明',
      lines:  p.line_names ?? [],
      commute,
    }
  }

  cached = {
    stations,
    manualRent:     manualRent.stations  ?? {},
    governmentRent: govRent.stations     ?? {},
  }
  return cached
}
