/**
 * /to ランディング群（hub + 30 駅個別頁）共用の目的地統計 loader。
 * server component 専用（node:fs 使用）。SSG 時に geojson + 政府家賃から
 * 「30/45 分圏の駅数・45 分圏平均家賃」を算出する。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { DESTINATIONS_META, type FixedDestination } from '@/lib/destinations'

export type DestStats = {
  within30: number
  within45: number
  avgRent: number
}

export const loadDestinationStats = cache(
  async (): Promise<Record<FixedDestination, DestStats>> => {
    const geojsonPath = path.join(process.cwd(), 'public/data/stations.geojson')
    const rentPath = path.join(process.cwd(), 'public/data/station_government_rent.json')
    const [geoRaw, rentRaw] = await Promise.all([
      fs.readFile(geojsonPath, 'utf-8'),
      fs.readFile(rentPath, 'utf-8'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo = JSON.parse(geoRaw) as { features: any[] }
    const rent = JSON.parse(rentRaw) as { stations: Record<string, number> }

    const stats = {} as Record<FixedDestination, DestStats>
    for (const meta of DESTINATIONS_META) {
      let within30 = 0
      let within45 = 0
      const rents: number[] = []
      for (const f of geo.features) {
        const min = f.properties[`min_to_${meta.slug}`]
        if (typeof min !== 'number') continue
        if (min <= 30) within30 += 1
        if (min <= 45) {
          within45 += 1
          const r = rent.stations[String(f.properties.code)]
          if (typeof r === 'number') rents.push(r / 10000)
        }
      }
      const avgRent = rents.length
        ? rents.reduce((a, b) => a + b, 0) / rents.length
        : 0
      stats[meta.slug] = { within30, within45, avgRent }
    }
    return stats
  },
)
