// components/MapView.tsx
'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination, Station } from '@/app/page'

const BUCKET_COLORS = [
  '#22c55e',  // 0: <15分
  '#84cc16',  // 1: 15-29分
  '#eab308',  // 2: 30-44分
  '#f97316',  // 3: 45-59分
  '#ef4444',  // 4: 60-74分
  '#991b1b',  // 5: 75分+
]

interface Props {
  destination: Destination
  maxMinutes: number
  onStationClick: (station: Station) => void
}

export default function MapView({ destination, maxMinutes, onStationClick }: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [139.6917, 35.6895],
      zoom: 10,
    })

    map.on('load', async () => {
      const res = await fetch('/data/stations.geojson')
      const geojson = await res.json()

      map.addSource('stations', { type: 'geojson', data: geojson })

      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 8],
          'circle-color': [
            'match', ['get', 'bucket'],
            0, BUCKET_COLORS[0], 1, BUCKET_COLORS[1],
            2, BUCKET_COLORS[2], 3, BUCKET_COLORS[3],
            4, BUCKET_COLORS[4], BUCKET_COLORS[5],
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
        filter: ['<=', ['get', `min_to_${destination}`], maxMinutes],
      })

      map.on('click', 'stations-circle', (e) => {
        const props = e.features?.[0]?.properties
        const geo = e.features?.[0]?.geometry as any
        if (!props || !geo) return
        onStationClick({
          code: props.code,
          name: props.name,
          lat: geo.coordinates[1],
          lon: geo.coordinates[0],
          min_to_shinjuku: props.min_to_shinjuku,
          min_to_shibuya:  props.min_to_shibuya,
          min_to_tokyo:    props.min_to_tokyo,
          bucket: props.bucket,
        })
      })

      map.on('mouseenter', 'stations-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'stations-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // 滑块/目的地变化 → 纯前端过滤，零延迟
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getLayer('stations-circle')) return
    map.setFilter('stations-circle', [
      'all',
      ['has', `min_to_${destination}`],
      ['<=', ['get', `min_to_${destination}`], maxMinutes],
    ])
  }, [destination, maxMinutes])

  return <div ref={containerRef} className="w-full h-full" />
}
