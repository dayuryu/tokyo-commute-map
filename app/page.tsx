'use client'
import { useState, useEffect } from 'react'
import MapView from '@/components/MapView'
import TimeSlider from '@/components/TimeSlider'
import DestinationPicker from '@/components/DestinationPicker'
import StationDrawer from '@/components/StationDrawer'
import TransferFilter from '@/components/TransferFilter'
import { supabase } from '@/lib/supabase'

export type Destination = 'shinjuku' | 'shibuya' | 'tokyo' | 'custom'

export type ConsensusEntry = { min: number; count: number }
export type ConsensusMap = Record<
  number,
  Partial<Record<Exclude<Destination, 'custom'>, ConsensusEntry>>
>

export interface CustomStation {
  code: number
  name: string
  lat: number
  lon: number
}

export interface Station {
  code: number
  name: string
  lat: number
  lon: number
  min_to_shinjuku?: number
  min_to_shibuya?: number
  min_to_tokyo?: number
  min_to_custom?: number
  transfers_to_shinjuku?: number
  transfers_to_shibuya?: number
  transfers_to_tokyo?: number
  bucket: number
}

export default function Home() {
  const [destination, setDestination] = useState<Destination>('shinjuku')
  const [maxMinutes, setMaxMinutes] = useState(45)
  const [maxTransfers, setMaxTransfers] = useState(99)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [customStation, setCustomStation] = useState<CustomStation | null>(null)
  const [stationList, setStationList] = useState<CustomStation[]>([])
  const [consensus, setConsensus] = useState<ConsensusMap>({})

  useEffect(() => {
    fetch('/data/stations.geojson')
      .then(r => r.json())
      .then(g => setStationList(
        g.features.map((f: any) => ({
          code: f.properties.code,
          name: f.properties.name,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        }))
      ))
  }, [])

  useEffect(() => {
    supabase
      .from('station_time_consensus')
      .select('station_code, destination, consensus_min, report_count')
      .then(({ data, error }) => {
        if (error || !data) return
        const map: ConsensusMap = {}
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
  }, [])

  function handleDestinationChange(v: Destination) {
    setDestination(v)
    if (v !== 'custom') setCustomStation(null)
  }

  function handleCustomChange(station: CustomStation) {
    setCustomStation(station)
    setDestination('custom')
  }

  return (
    <main className="relative w-full h-full">
      <MapView
        destination={destination}
        maxMinutes={maxMinutes}
        maxTransfers={maxTransfers}
        onStationClick={setSelectedStation}
        customStation={customStation}
      />

      {/* 顶部控制栏 — モバイル2行 / デスクトップ1行 */}
      <div className="absolute top-3 left-3 right-3
                      md:top-4 md:left-1/2 md:right-auto md:-translate-x-1/2
                      z-10 flex flex-col md:flex-row md:items-center
                      gap-2 md:gap-4 bg-white/90 backdrop-blur
                      rounded-2xl shadow-lg px-4 md:px-6 py-3">

        {/* 行1: 目的地ピッカー */}
        <DestinationPicker
          value={destination}
          onChange={handleDestinationChange}
          stationList={stationList}
          customStation={customStation}
          onCustomChange={handleCustomChange}
        />

        {/* デスクトップ用区切り */}
        <div className="hidden md:block w-px h-6 bg-gray-200" />

        {/* モバイル区切り線 */}
        <div className="md:hidden h-px bg-gray-100" />

        {/* 行2: スライダー + 乗換フィルター */}
        <div className="flex items-center gap-3">
          <TimeSlider value={maxMinutes} onChange={setMaxMinutes} />
          <div className="w-px h-5 bg-gray-200" />
          <TransferFilter value={maxTransfers} onChange={setMaxTransfers} />
        </div>

      </div>

      <StationDrawer
        station={selectedStation}
        destination={destination}
        customStation={customStation}
        consensus={consensus}
        onClose={() => setSelectedStation(null)}
      />
    </main>
  )
}
