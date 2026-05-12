// components/MapView.tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination, Station, CustomStation } from '@/app/page'
import { BUCKET_COLORS, getBucketThresholds, bucketize } from '@/lib/buckets'
import { DESTINATIONS_META } from '@/lib/destinations'
import { computeCommutes, type PreparedGraph } from '@/lib/dijkstra'

// 30 個の fixed destination の coord / code / label は stations.geojson 読み込み時に
// 動的検索する（旧 v3.4 の hardcode 3 件を完全廃止）。
interface DestInfo {
  code:   number
  coords: [number, number]
  label:  string
}

// zoom < 9 で表示する主要乗換駅（関東核心 25 駅）
const MAJOR_STATION_NAMES = new Set([
  '新宿', '渋谷', '池袋', '東京', '品川', '上野', '秋葉原', '恵比寿',
  '目黒', '高田馬場', '田町', '有楽町',
  '横浜', '川崎', '武蔵小杉',
  '大宮', '浦和',
  '吉祥寺', '三鷹', '立川', '八王子', '町田',
  '船橋', '千葉', '柏',
])

// graph 未ロード時のみ使用される fallback 推算（直線距離 × 1.3 ÷ 35km/h）。
// graph がロードされていれば custom destination も Dijkstra で計算される。
function haversineMin(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 / 35 * 60
}

// custom destination 通勤時間 Map: { stationCode: { mins, transfers } }
type CustomCommutesMap = Map<number, { mins: number; transfers: number }> | null

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

// 全 feature を destination/maxMinutes/maxTransfers/customStation で絞り込む。
// cluster source も含めて両 source に同じ絞り込み済み配列を流すことで、
// cluster 円が「実際に到達不能なエリア」に出現しないことを保証する。
//
// bucket 属性は maxMinutes に応じて毎回再計算する（lib/buckets.ts）。
// これにより通勤上限スライダーを動かすたびに散点の色が範囲全体に再分布する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFilteredFeatures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawFeatures: any[],
  destination: Destination,
  maxMinutes: number,
  maxTransfers: number,
  customStation: CustomStation | null,
  destInfo: Record<string, DestInfo>,
  customCommutes: CustomCommutesMap,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const thresholds = getBucketThresholds(maxMinutes)

  // custom destination は graph があれば Dijkstra 結果を、なければ haversine fallback。
  // どちらの場合も min_to_custom / transfers_to_custom プロパティに書き込む。
  let features = rawFeatures
  if (customStation) {
    features = features.map((f: any) => {
      let mins: number | null = null
      let xfers: number | null = null
      if (customCommutes) {
        const r = customCommutes.get(f.properties.code)
        if (r) {
          mins  = r.mins
          xfers = r.transfers
        } else if (f.properties.code === customStation.code) {
          mins  = 0
          xfers = 0
        }
      } else {
        // graph 未ロード時の fallback
        const [lon, lat] = f.geometry.coordinates
        mins = Math.round(haversineMin(customStation.lat, customStation.lon, lat, lon))
      }
      return {
        ...f,
        properties: {
          ...f.properties,
          min_to_custom:       mins ?? undefined,
          transfers_to_custom: xfers ?? undefined,
        },
      }
    })
  }

  const excludeCode = destination === 'custom'
    ? (customStation?.code ?? -1)
    : (destInfo[destination]?.code ?? -1)

  // 絞り込み + bucket 動的再計算（properties.bucket を上書き）
  return features.flatMap((f: any) => {
    const p = f.properties
    if (p.code === excludeCode) return []
    const min = destination === 'custom'
      ? p.min_to_custom
      : p[`min_to_${destination}`]
    if (min == null || min > maxMinutes) return []
    if (maxTransfers < 99) {
      // custom / fixed 両方とも乗換数フィルタが効くようにする。
      // custom かつ graph 未ロード（haversine fallback）の場合は transfers が
      // 取れないので、安全側に倒して filter を無効化する（= 全表示）。
      const tr = destination === 'custom'
        ? p.transfers_to_custom
        : p[`transfers_to_${destination}`]
      if (destination === 'custom' && tr == null) {
        // haversine fallback 中 → filter skip
      } else if (tr == null || tr > maxTransfers) {
        return []
      }
    }
    return [{
      ...f,
      properties: { ...p, bucket: bucketize(min, thresholds) },
    }]
  })
}

// cluster の集計プロパティを動的生成（30 個の fixed destination + custom 用）。
// MapLibre は source 作成時に clusterProperties を fix するため、destination 全種
// 分を予め declare する必要がある。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClusterProperties(): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {}
  for (const meta of DESTINATIONS_META) {
    const field = `min_to_${meta.slug}`
    props[`sum_${meta.slug}`] = ['+', ['case', ['has', field], ['get', field], 0]]
    props[`cnt_${meta.slug}`] = ['+', ['case', ['has', field], 1, 0]]
  }
  // custom（実行時に inject される min_to_custom 用）
  props.sum_custom = ['+', ['case', ['has', 'min_to_custom'], ['get', 'min_to_custom'], 0]]
  props.cnt_custom = ['+', ['case', ['has', 'min_to_custom'], 1, 0]]
  return props
}

// cluster 円の色：destination の平均通勤時間で動的染色。
// thresholds は maxMinutes に応じて変動するため、毎回式を組み直す。
// custom も同じ step expression で扱う（sum_custom / cnt_custom が
// clusterProperties で集計されている）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClusterColor(destination: Destination, maxMinutes: number): any {
  const thresholds = getBucketThresholds(maxMinutes)
  // step 式: [step, value, default, stop1, color1, stop2, color2, ...]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expr: any[] = [
    'step',
    ['/',
      ['get', `sum_${destination}`],
      ['max', ['get', `cnt_${destination}`], 1],
    ],
    BUCKET_COLORS[0],
  ]
  thresholds.forEach((t, i) => {
    expr.push(t, BUCKET_COLORS[i + 1])
  })
  return expr
}

interface Props {
  destination: Destination
  maxMinutes: number
  maxTransfers: number
  onStationClick: (station: Station) => void
  customStation: CustomStation | null
  graph: PreparedGraph | null
  /** 初回 idle（タイル＋レイヤ描画完了）で 1 度だけ発火する任意 callback。
   *  LoadingOverlay のフェードアウト用。 */
  onReady?: () => void
}

export default function MapView({ destination, maxMinutes, maxTransfers, onStationClick, customStation, graph, onReady }: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojsonRef = useRef<any>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  // 30 個の fixed destination の info（onload で計算、destInfoReady を立てて re-render）
  const destInfoRef = useRef<Record<string, DestInfo>>({})
  const [destInfoReady, setDestInfoReady] = useState(false)
  const isFirstRender = useRef(true)

  // ── カスタム目的地：Dijkstra 結果 cache ─────────────────────────────────
  // customStation / graph が変化したときのみ再計算（重い処理を maxMinutes
  // スライダー操作で毎回走らせない）。Map<code, {mins, transfers}>。
  const customCommutes = useMemo<CustomCommutesMap>(() => {
    if (!customStation || !graph) return null
    return computeCommutes(graph, customStation.code)
  }, [customStation, graph])

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

      // is_major プロパティを注入（zoom 適応表示用）
      geojson.features = geojson.features.map((f: any) => ({
        ...f,
        properties: {
          ...f.properties,
          is_major: MAJOR_STATION_NAMES.has(f.properties.name),
        },
      }))

      geojsonRef.current = geojson

      // 30 個の fixed destination の info（coords / code / label）を geojson から動的検索
      const destInfo: Record<string, DestInfo> = {}
      for (const meta of DESTINATIONS_META) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = geojson.features.find((f: any) =>
          f.properties.name === meta.displayName || f.properties.name === meta.transitName
        )
        if (matched) {
          const [lon, lat] = matched.geometry.coordinates
          destInfo[meta.slug] = {
            code:   matched.properties.code,
            coords: [lon, lat],
            label:  meta.displayName,
          }
        }
      }
      destInfoRef.current = destInfo
      setDestInfoReady(true)

      // 初期 props で絞り込み済みの features を作成し、両 source に流す
      const initialFiltered = buildFilteredFeatures(
        geojson.features, destination, maxMinutes, maxTransfers, customStation, destInfo,
        customCommutes,
      )
      const initialData = { ...geojson, features: initialFiltered }

      // ── Source 1: 個別表示用 ──
      map.addSource('stations', { type: 'geojson', data: initialData })

      // ── Source 2: 集約表示用（cluster + 平均値プリ集計） ──
      map.addSource('stations-clustered', {
        type: 'geojson',
        data: initialData,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 13,
        clusterProperties: buildClusterProperties(),
      })

      // ── 個別表示 Layers（zoom >= 11 で出現、デフォルトズーム 10 では非表示） ──
      // データの絞り込みは source レベルで行うため layer filter は is_major 区別のみ
      // 主要駅（強調表示用に円が少し大きい）
      map.addLayer({
        id: 'stations-major',
        type: 'circle',
        source: 'stations',
        minzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 9],
          'circle-color': [
            'match', ['get', 'bucket'],
            0, BUCKET_COLORS[0], 1, BUCKET_COLORS[1],
            2, BUCKET_COLORS[2], 3, BUCKET_COLORS[3],
            4, BUCKET_COLORS[4], BUCKET_COLORS[5],
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
        filter: ['==', ['get', 'is_major'], true],
      })

      // 一般駅（zoom >= 11、主要駅と同時に展開）
      map.addLayer({
        id: 'stations-minor',
        type: 'circle',
        source: 'stations',
        minzoom: 11,
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
        filter: ['==', ['get', 'is_major'], false],
      })

      // 主要駅名ラベル（zoom >= 10、cluster 段階でも代表駅名は見える）
      map.addLayer({
        id: 'stations-label-major',
        type: 'symbol',
        source: 'stations',
        minzoom: 10,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 13],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-padding': 4,
        },
        paint: {
          'text-color': '#1c1812',
          'text-halo-color': '#f4f1ea',
          'text-halo-width': 1.8,
        },
        filter: ['==', ['get', 'is_major'], true],
      })

      // 一般駅名ラベル（zoom >= 11、単点 layer と同期出現）
      map.addLayer({
        id: 'stations-label',
        type: 'symbol',
        source: 'stations',
        minzoom: 11,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 12],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-padding': 2,
        },
        paint: {
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
        filter: ['==', ['get', 'is_major'], false],
      })

      // ── 集約 Layers（zoom < 11 で出現、デフォルトズーム 10 で表示） ──
      // 集約円
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'stations-clustered',
        maxzoom: 11,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'step', ['get', 'point_count'],
            16,
            10, 22,
            30, 28,
            100, 36,
          ],
          'circle-color': getClusterColor(destination, maxMinutes),
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // 集約数ラベル
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'stations-clustered',
        maxzoom: 11,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.4)',
          'text-halo-width': 0.8,
        },
      })

      // 集約しきれなかった孤立駅（cluster source の unclustered point、zoom < 11 のみ）
      map.addLayer({
        id: 'clusters-unclustered',
        type: 'circle',
        source: 'stations-clustered',
        maxzoom: 11,
        filter: ['!', ['has', 'point_count']],
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
      })

      // ── 駅クリック・ホバー（major/minor/unclustered 共通） ──
      const stationLayers = ['stations-major', 'stations-minor', 'clusters-unclustered']
      stationLayers.forEach(layerId => {
        map.on('click', layerId, (e) => {
          const props = e.features?.[0]?.properties
          const geo = e.features?.[0]?.geometry as any
          if (!props || !geo) return
          // MapLibre は GeoJSON properties の配列を JSON 文字列に
          // シリアライズすることがあるため、両方のケースを許容する
          let lineNames: string[] = []
          if (Array.isArray(props.line_names)) {
            lineNames = props.line_names
          } else if (typeof props.line_names === 'string' && props.line_names) {
            try { lineNames = JSON.parse(props.line_names) } catch { /* noop */ }
          }
          onStationClick({
            code: props.code,
            name: props.name,
            lat: geo.coordinates[1],
            lon: geo.coordinates[0],
            min_to_shinjuku:       props.min_to_shinjuku,
            min_to_shibuya:        props.min_to_shibuya,
            min_to_tokyo:          props.min_to_tokyo,
            min_to_custom:         props.min_to_custom,
            transfers_to_shinjuku: props.transfers_to_shinjuku,
            transfers_to_shibuya:  props.transfers_to_shibuya,
            transfers_to_tokyo:    props.transfers_to_tokyo,
            transfers_to_custom:   props.transfers_to_custom,
            bucket: props.bucket,
            line_names: lineNames,
          })
        })
        map.on('mouseenter', layerId, (e) => {
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features?.[0]?.properties
          const geo = e.features?.[0]?.geometry as any
          if (!props || !geo) return
          popup
            .setLngLat(geo.coordinates)
            .setHTML(`<span class="station-popup-name">${props.name}</span>`)
            .addTo(map)
        })
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
      })

      // ── 集約円クリック → 展開ズーム ──
      map.on('click', 'clusters', async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0]?.properties?.cluster_id
        if (clusterId == null) return
        const source = map.getSource('stations-clustered') as any
        try {
          const zoom = await source.getClusterExpansionZoom(clusterId)
          const geo = features[0].geometry as any
          map.easeTo({ center: geo.coordinates, zoom, duration: 600 })
        } catch {
          /* ignore */
        }
      })
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

      // 全タイル + レイヤ描画完了の最初の idle で onReady を発火（1 度きり）。
      // LoadingOverlay のフェードアウトトリガー。
      map.once('idle', () => { onReady?.() })
    })

    // safety net: 8s 経っても idle が来ない場合は強制的に ready 扱い
    // （タイル取得が遅延した時のフリーズ防止）。
    const readyFallback = window.setTimeout(() => { onReady?.() }, 8000)

    mapRef.current = map
    return () => {
      window.clearTimeout(readyFallback)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── 両 source のデータをフィルター適用後に更新 ──
  // cluster は source レベルでの集計なので、layer filter では絞れない。
  // データ自体を絞り込むことで cluster 円が「到達不能なエリア」に出現しないことを保証する。
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('stations') || !geojsonRef.current) return

    const filtered = buildFilteredFeatures(
      geojsonRef.current.features,
      destination, maxMinutes, maxTransfers, customStation,
      destInfoRef.current,
      customCommutes,
    )
    const data = { ...geojsonRef.current, features: filtered }
    ;(map.getSource('stations')           as maplibregl.GeoJSONSource).setData(data)
    ;(map.getSource('stations-clustered') as maplibregl.GeoJSONSource).setData(data)

    // cluster 円の step 式は maxMinutes に依存するため、ここで毎回更新
    if (map.getLayer('clusters')) {
      map.setPaintProperty('clusters', 'circle-color', getClusterColor(destination, maxMinutes))
    }
  }, [destination, maxMinutes, maxTransfers, customStation, customCommutes])

  // ── 目的地変化 → ピン更新 + flyTo + cluster 円色更新 ──
  // destInfoReady を依存に含めることで、geojson load 完了後の初回 marker 設置を保証
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let coords: [number, number] | null = null
    let label = ''

    if (destination === 'custom' && customStation) {
      coords = [customStation.lon, customStation.lat]
      label = customStation.name
    } else if (destination !== 'custom') {
      const info = destInfoRef.current[destination]
      if (info) {
        coords = info.coords
        label = info.label
      }
    }

    markerRef.current?.remove()
    markerRef.current = null

    if (coords) {
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
    }

  }, [destination, customStation, destInfoReady])

  return <div ref={containerRef} className="w-full h-full" />
}
