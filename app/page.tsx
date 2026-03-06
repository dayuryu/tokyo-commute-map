'use client'
import { useState } from 'react'
import MapView from '@/components/MapView'
import TimeSlider from '@/components/TimeSlider'
import DestinationPicker from '@/components/DestinationPicker'
import StationDrawer from '@/components/StationDrawer'

export type Destination = 'shinjuku' | 'shibuya' | 'tokyo'

export interface Station {
  code: number
  name: string
  lat: number
  lon: number
  min_to_shinjuku?: number
  min_to_shibuya?: number
  min_to_tokyo?: number
  bucket: number
}

export default function Home() {
  const [destination, setDestination] = useState<Destination>('shinjuku')
  const [maxMinutes, setMaxMinutes] = useState(45)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  return (
    <main className="relative w-full h-full">
      <MapView
        destination={destination}
        maxMinutes={maxMinutes}
        onStationClick={setSelectedStation}
      />

      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                      flex items-center gap-4 bg-white/90 backdrop-blur
                      rounded-2xl shadow-lg px-6 py-3">
        <DestinationPicker value={destination} onChange={setDestination} />
        <div className="w-px h-6 bg-gray-200" />
        <TimeSlider value={maxMinutes} onChange={setMaxMinutes} />
      </div>

      <StationDrawer
        station={selectedStation}
        destination={destination}
        onClose={() => setSelectedStation(null)}
      />
    </main>
  )
}
