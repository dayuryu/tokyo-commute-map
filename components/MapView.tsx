// components/MapView.tsx
'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination, Station, CustomStation } from '@/app/page'

const DEST_COORDS: Record<string, [number, number]> = {
  shinjuku: [139.7003, 35.6905],
  shibuya:  [139.7016, 35.6580],
  tokyo:    [139.7671, 35.6812],
}

const DEST_LABELS: Record<string, string> = {
  shinjuku: '新宿',
  shibuya:  '渋谷',
  tokyo:    '東京駅',
}

const BUCKET_COLORS = [
  '#22c55e',  // 0: <15分
  '#84cc16',  // 1: 15-29分
  '#eab308',  // 2: 30-44分
  '#f97316',  // 3: 45-59分
  '#ef4444',  // 4: 60-74分
  '#991b1b',  // 5: 75分+
]

function haversineMin(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 / 35 * 60
}

// 目的地ピンをインラインスタイルで生成（CSS クラス依存なし）
function createPinElement(label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'position:relative; width:32px; cursor:default;'
  el.innerHTML = `
    <svg width="32" height="44" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 44 16 44C16 44 32 28 32 16C32 7.16 24.84 0 16 0Z"
            fill="#dc2626" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="7" fill="white"/>
    </svg>
    <div style="
      position:absolute; top:46px; left:50%; transform:translateX(-50%);
      background:#dc2626; color:white; font-size:11px; font-weight:700;
      padding:2px 8px; border-radius:5px; white-space:nowrap;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    ">${label}</div>
  `
  return el
}

interface Props {
  destination: Destination
  maxMinutes: number
  onStationClick: (station: Station) => void
  customStation: CustomStation | null
}

export default function MapView({ destination, maxMinutes, onStationClick, customStation }: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const geojsonRef = useRef<any>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const destCodesRef = useRef<Record<string, number>>({})
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [139.6917, 35.6895],
      zoom: 10,
    })

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: 'station-popup',
    })

    map.on('load', async () => {
      const res = await fetch('/data/stations.geojson')
      const geojson = await res.json()
      geojsonRef.current = geojson

      // 固定目的地の station code を事前検索
      const destCodes: Record<string, number> = {}
      for (const [key, [dlon, dlat]] of Object.entries(DEST_COORDS)) {
        let minDist = Infinity, minCode = -1
        for (const f of geojson.features) {
          const [lon, lat] = f.geometry.coordinates
          const d = (lon - dlon) ** 2 + (lat - dlat) ** 2
          if (d < minDist) { minDist = d; minCode = f.properties.code }
        }
        destCodes[key] = minCode
      }
      destCodesRef.current = destCodes

      map.addSource('stations', { type: 'geojson', data: geojson })

      const initialExclude = destCodes['shinjuku'] ?? -1
      const initialFilter: any = ['all',
        ['!=', ['get', 'code'], initialExclude],
        ['<=', ['get', 'min_to_shinjuku'], maxMinutes],
      ]

      // 散点レイヤー
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
        filter: initialFilter,
      })

      // ズームイン時の駅名ラベルレイヤー（zoom >= 12 で表示）
      map.addLayer({
        id: 'stations-label',
        type: 'symbol',
        source: 'stations',
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
        filter: initialFilter,
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
          min_to_custom:   props.min_to_custom,
          bucket: props.bucket,
        })
      })

      map.on('mouseenter', 'stations-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const props = e.features?.[0]?.properties
        const geo = e.features?.[0]?.geometry as any
        if (!props || !geo) return
        popup
          .setLngLat(geo.coordinates)
          .setHTML(`<span class="station-popup-name">${props.name}</span>`)
          .addTo(map)
      })
      map.on('mouseleave', 'stations-circle', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // カスタム駅変更 → 距離再計算 & ソースデータ更新
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('stations-circle') || !geojsonRef.current) return

    if (customStation) {
      const newFeatures = geojsonRef.current.features.map((f: any) => {
        const [lon, lat] = f.geometry.coordinates
        const minutes = haversineMin(customStation.lat, customStation.lon, lat, lon)
        const bucket = Math.min(5, Math.floor(minutes / 15))
        return {
          ...f,
          properties: { ...f.properties, min_to_custom: Math.round(minutes), bucket },
        }
      })
      ;(map.getSource('stations') as maplibregl.GeoJSONSource).setData({
        ...geojsonRef.current,
        features: newFeatures,
      })
    } else {
      ;(map.getSource('stations') as maplibregl.GeoJSONSource).setData(geojsonRef.current)
    }
  }, [customStation])

  // 目的地変化 → ピンマーカー更新 + flyTo アニメーション
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let coords: [number, number] | null = null
    let label = ''

    if (destination === 'custom' && customStation) {
      coords = [customStation.lon, customStation.lat]
      label = customStation.name
    } else if (destination !== 'custom') {
      coords = DEST_COORDS[destination]
      label = DEST_LABELS[destination]
    }

    markerRef.current?.remove()
    markerRef.current = null

    if (!coords) return

    markerRef.current = new maplibregl.Marker({
      element: createPinElement(label),
      anchor: 'bottom',
    })
      .setLngLat(coords)
      .addTo(map)

    if (!isFirstRender.current) {
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 11), duration: 1200, essential: true })
    }
    isFirstRender.current = false
  }, [destination, customStation])

  // 目的地/スライダー変化 → フィルター更新（目的地駅を除外）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('stations-circle')) return

    const excludeCode = destination === 'custom'
      ? (customStation?.code ?? -1)
      : (destCodesRef.current[destination] ?? -1)

    const rangeFilter: any = destination === 'custom'
      ? ['<=', ['get', 'min_to_custom'], maxMinutes]
      : ['all', ['has', `min_to_${destination}`], ['<=', ['get', `min_to_${destination}`], maxMinutes]]

    const filter: any = ['all', ['!=', ['get', 'code'], excludeCode], rangeFilter]

    map.setFilter('stations-circle', filter)
    if (map.getLayer('stations-label')) map.setFilter('stations-label', filter)
  }, [destination, maxMinutes, customStation])

  return <div ref={containerRef} className="w-full h-full" />
}
