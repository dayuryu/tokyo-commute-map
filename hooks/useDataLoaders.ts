'use client'

/**
 * page.tsx に散在していた 9 本のデータ加載 useEffect を集約する hook（ADR-0003 P2）。
 *
 * 各 fetch 完了後に対応する data atom へ書き込む。ADR-0003 の方針に従い
 * async/loadable atom は使わず、現状の useEffect→setState を useEffect→setAtom に
 * 置き換えただけの byte-for-byte 等価な平行移動とする。
 *
 * locale は areaFeatures の加載にのみ必要（next-intl の useLocale から渡す）。
 * それ以外の effect は依存配列に setter のみを持ち、初回マウントで一度だけ走る。
 */
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { supabase } from '@/lib/supabase'
import type { CustomStation, Station, ConsensusMap, Destination } from '@/lib/types'
import { type SuumoStationMap, type SuumoStationEntry } from '@/lib/affiliate'
import { loadManualRentData } from '@/lib/manual-rent'
import { loadGovernmentRentData } from '@/lib/government-rent'
import { loadLineStyles } from '@/lib/line-styles'
import { loadAreaFeaturesData } from '@/lib/area-features'
import { loadStationEntrances } from '@/lib/station-entrances'
import { prepareGraph, type GraphData } from '@/lib/dijkstra'
import {
  stationListAtom,
  stationByNameAtom,
  consensusAtom,
  suumoMapAtom,
  rentMapAtom,
  governmentRentAtom,
  lineStylesAtom,
  lineNamesEnAtom,
  stationEntrancesAtom,
  graphAtom,
} from '@/lib/atoms/data'
import { areaFeaturesAtom } from '@/lib/atoms/area-features'

export function useDataLoaders(locale: string) {
  const setStationList = useSetAtom(stationListAtom)
  const setStationByName = useSetAtom(stationByNameAtom)
  const setConsensus = useSetAtom(consensusAtom)
  const setSuumoMap = useSetAtom(suumoMapAtom)
  const setRentMap = useSetAtom(rentMapAtom)
  const setGovernmentRent = useSetAtom(governmentRentAtom)
  const setLineStyles = useSetAtom(lineStylesAtom)
  const setLineNamesEn = useSetAtom(lineNamesEnAtom)
  const setAreaFeatures = useSetAtom(areaFeaturesAtom)
  const setStationEntrances = useSetAtom(stationEntrancesAtom)
  const setGraph = useSetAtom(graphAtom)

  // stations.geojson → stationList + stationByName（同一 fetch で両方 set）
  useEffect(() => {
    fetch('/data/stations.geojson')
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((g: any) => {
        const list: CustomStation[] = []
        const byName: Record<string, Station> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const f of g.features as any[]) {
          const p = f.properties
          const lat = f.geometry.coordinates[1]
          const lon = f.geometry.coordinates[0]
          list.push({ code: p.code, name: p.name, nameEn: p.name_en, lat, lon })
          // 同名駅が存在する場合は最初の 1 件を保持（実用上稀）。
          if (!byName[p.name]) {
            byName[p.name] = { ...p, lat, lon } as Station
          }
        }
        setStationList(list)
        setStationByName(byName)
      })
  }, [setStationList, setStationByName])

  // graph.json（カスタム目的地用 adjacency graph）。失敗時は graph=null のまま。
  useEffect(() => {
    fetch('/data/graph.json')
      .then(r => r.ok ? r.json() as Promise<GraphData> : Promise.reject(new Error('graph not available')))
      .then(raw => setGraph(prepareGraph(raw)))
      .catch(() => {
        // graph 未配信時は haversine fallback。あえてエラーログを出さない。
      })
  }, [setGraph])

  // SUUMO 駅 deep link マップ。未生成（404）の場合は null のまま fallback。
  useEffect(() => {
    fetch('/data/suumo_stations.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('suumo map not available')))
      .then((list: SuumoStationEntry[]) => {
        const map: SuumoStationMap = {}
        for (const e of list) {
          if (!map[e.name]) map[e.name] = e
        }
        setSuumoMap(map)
      })
      .catch(() => {
        // suumo map 未配信時は SUUMO トップへの fallback で動作する
      })
  }, [setSuumoMap])

  // 手動収録家賃データ（101 駅）。
  useEffect(() => {
    loadManualRentData().then(data => {
      if (data?.stations) setRentMap(data.stations)
    })
  }, [setRentMap])

  // 政府住宅統計家賃データ（1940 駅 baseline）。
  useEffect(() => {
    loadGovernmentRentData().then(data => {
      if (data?.stations) setGovernmentRent(data.stations)
    })
  }, [setGovernmentRent])

  // 路線スタイル（color/symbol）map。
  useEffect(() => {
    loadLineStyles().then(map => {
      if (map) setLineStyles(map)
    })
  }, [setLineStyles])

  // 路線名 → 英語名 map（en locale の表示用）。en 以外では fetch しない。
  useEffect(() => {
    if (locale !== 'en') return
    fetch('/data/line_names_en.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('line names en not available')))
      .then((map: Record<string, string>) => setLineNamesEn(map))
      .catch(() => {
        // 未配信時は日本語路線名のまま表示する
      })
  }, [locale, setLineNamesEn])

  // 駅周辺エリアの AI 要約データ（1843 駅）。locale ごとに分かれた JSON を取得。
  useEffect(() => {
    loadAreaFeaturesData(locale).then(data => {
      if (data?.stations) setAreaFeatures(data.stations)
    })
  }, [locale, setAreaFeatures])

  // 駅出入口座標 map。locale 非依存。
  useEffect(() => {
    loadStationEntrances().then(map => {
      if (map) setStationEntrances(map)
    })
  }, [setStationEntrances])

  // 通勤時間合意値（supabase view）。
  useEffect(() => {
    supabase
      .from('station_time_consensus')
      .select('station_code, destination, consensus_min, report_count')
      .then(({ data, error }) => {
        if (error || !data) return
        const map: ConsensusMap = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((row: any) => {
          const dest = row.destination as Exclude<Destination, 'custom'>
          if (!map[row.station_code]) map[row.station_code] = {}
          map[row.station_code]![dest] = {
            min:   Number(row.consensus_min),
            count: Number(row.report_count),
          }
        })
        setConsensus(map)
      })
  }, [setConsensus])
}
