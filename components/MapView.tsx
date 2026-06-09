// components/MapView.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useLocale } from 'next-intl'
import maplibregl from 'maplibre-gl'
import type { Destination, CustomStation, CustomCommutesMap } from '@/lib/types'
import { BUCKET_COLORS, getBucketThresholds, bucketize } from '@/lib/buckets'
import { DESTINATIONS_META } from '@/lib/destinations'
import { stationLabel } from '@/lib/station-label'
import { maxMinutesAtom, maxTransfersAtom, selectedStationAtom } from '@/lib/atoms/ui'
import { destinationAtom, customStationAtom } from '@/lib/atoms/domain'
import { customCommutesAtom, aiHighlightFeaturesAtom } from '@/lib/atoms/derived'
import { favoriteFeaturesAtom } from '@/lib/atoms/favorites'

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

// destination / customStation / customCommutes / aiHighlightFeatures は atom 層から
// 自取（ADR-0003 P4）。MapView の props は外部 callback (onReady) のみ。

// 目的地ピンをインラインスタイルで生成（CSS クラス依存なし）
// anchor='top-left' + offset=[-16,-44] で SVG bottom を station 座標に揃える設計
// (2026-05-17 改修)。anchor='bottom' および anchor='top' は CSS percent transform
// (translate(-50%, ...)) で element 自身 width/height を参照するため、absolute
// child や whitespace 等の影響で結果がブラウザ依存になり pin 尖点がずれる現象を確認。
// 'top-left' = translate(0, 0) は percent なし、純粋に pos pixel offset で配置
// される。element top-left = pos = (station_x - 16, station_y - 44) と確定し、
// SVG block (44px) は element 顶部に張り付くので
// SVG bottom = element top + 44 = station Y で必ず揃う（ブラウザ非依存）。
function createPinElement(label: string): HTMLElement {
  const el = document.createElement('div')
  // position は設定しない (.maplibregl-marker class が position:absolute を提供する)。
  // inline 'position:relative' は specificity が class より高く、class の absolute を
  // 上書きして wrapper が normal flow に戻り、前の marker (red pin) に押し下げられて
  // transform に余計な 44px が乗る (2026-05-17 報告、red dot 対照で確定)。
  // absolute child label は absolute な wrapper を containing block とするので
  // wrapper が absolute のままで top:46/left:50% も問題なく機能する。
  el.style.cssText = 'width:32px; height:44px; cursor:default;'
  el.innerHTML = `
    <svg width="32" height="44" viewBox="0 0 32 44" style="display:block" xmlns="http://www.w3.org/2000/svg">
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

// 選択中（=「住居検討対象」）の駅マーカー。通勤目的地（赤）と区別するため INK 黒 + cream 中心。
// editorial palette に合わせた配色で、赤ピンと色相を変えつつ「ピン形」で関連を示す。
// 通勤先と同じ駅が選ばれた場合は親側で表示しないので、ここでは衝突を考慮しない。
//
// サイズは赤ピンと完全に同一 (32×44 viewBox、32×44 描画)。
// anchor='top-left' + offset=[-16,-44] で SVG bottom を station 座標に揃える設計
// (createPinElement と同方針)。詳細は createPinElement のコメント参照。
function createSelectedPinElement(label: string): HTMLElement {
  const el = document.createElement('div')
  // position は設定しない (createPinElement と同方針、詳細はそちら参照)
  el.style.cssText = 'width:32px; height:44px; cursor:default;'
  el.innerHTML = `<svg width="32" height="44" viewBox="0 0 32 44" style="display:block" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 44 16 44C16 44 32 28 32 16C32 7.16 24.84 0 16 0Z" fill="#1c1812" stroke="#f5e7d2" stroke-width="2"/><circle cx="16" cy="16" r="7" fill="#f5e7d2"/></svg><div style="position:absolute; top:46px; left:50%; transform:translateX(-50%); background:#1c1812; color:#f5e7d2; font-size:11px; font-weight:600; letter-spacing:.04em; padding:2px 8px; border-radius:3px; white-space:nowrap; box-shadow:0 1px 4px rgba(0,0,0,0.25);">${label}</div>`
  return el
}

// 全 feature を destination/maxMinutes/maxTransfers/customStation で絞り込む。
// cluster source も含めて両 source に同じ絞り込み済み配列を流すことで、
// cluster 円が「実際に到達不能なエリア」に出現しないことを保証する。
//
// bucket 属性は maxMinutes に応じて毎回再計算する（lib/buckets.ts）。
// これにより通勤上限スライダーを動かすたびに散点の色が範囲全体に再分布する。
// stations.geojson のフィーチャ型。properties は template literal index signature で
// 動的キー（min_to_<dest> / transfers_to_<dest> / bucket_<dest>）を number に解決する。
interface StationProps {
  code:        number
  name:        string
  name_en?:    string
  bucket?:     number
  line_names?: string[] | string
  is_major?:   boolean
  [key: `min_to_${string}`]:       number | undefined
  [key: `transfers_to_${string}`]: number | undefined
  [key: `bucket_${string}`]:       number | undefined
}
type StationFeature = {
  type:       'Feature'
  geometry:   { type: 'Point'; coordinates: [number, number] }
  properties: StationProps
}
// MapLibre の feature.geometry（GeoJSON.Geometry union）から coordinates だけ取り出す用
type PointGeom = { coordinates: [number, number] }

function buildFilteredFeatures(
  rawFeatures: StationFeature[],
  destination: Destination,
  maxMinutes: number,
  maxTransfers: number,
  customStation: CustomStation | null,
  destInfo: Record<string, DestInfo>,
  customCommutes: CustomCommutesMap,
): StationFeature[] {
  const thresholds = getBucketThresholds(maxMinutes)

  // custom destination は graph があれば Dijkstra 結果を、なければ haversine fallback。
  // どちらの場合も min_to_custom / transfers_to_custom プロパティに書き込む。
  let features = rawFeatures
  if (customStation) {
    features = features.map((f) => {
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
  return features.flatMap((f) => {
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
  /** 初回 idle（タイル＋レイヤ描画完了）で 1 度だけ発火する任意 callback。
   *  LoadingOverlay のフェードアウト用。 */
  onReady?: () => void
}

export default function MapView({ onReady }: Props) {
  // locale 切替はフルナビゲーション（LocaleLink / LocaleButton が router.replace）
  // なので、map 初期化時に閉じ込めた値で一貫する。
  const locale = useLocale()
  const destination = useAtomValue(destinationAtom)
  const customStation = useAtomValue(customStationAtom)
  const customCommutes = useAtomValue(customCommutesAtom)
  const aiHighlightFeatures = useAtomValue(aiHighlightFeaturesAtom)
  const maxMinutes = useAtomValue(maxMinutesAtom)
  const maxTransfers = useAtomValue(maxTransfersAtom)
  const selectedStation = useAtomValue(selectedStationAtom)
  const setSelectedStation = useSetAtom(selectedStationAtom)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojsonRef = useRef<any>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  // 選択中駅ピン（黒）— 通勤先ピン (markerRef、赤) とは独立のマーカー
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null)
  // 30 個の fixed destination の info（onload で計算、destInfoReady を立てて re-render）
  const destInfoRef = useRef<Record<string, DestInfo>>({})
  const [destInfoReady, setDestInfoReady] = useState(false)
  const isFirstRender = useRef(true)
  // map.on('load') closure が capture する古い aiHighlightFeatures 値を回避するため ref を追従。
  // addSource 時に ref.current を使うことで source 創建瞬間の最新値が確実に反映される
  // （atomWithStorage hydrate と map load の race で「source は空のまま」になるバグの根治、
  // ADR-0003 P4 諸動の verify で発覚）。
  const aiHighlightFeaturesRef = useRef(aiHighlightFeatures)
  useEffect(() => { aiHighlightFeaturesRef.current = aiHighlightFeatures }, [aiHighlightFeatures])
  // お気に入り ★ も同じ race 対策（localStorage hydrate と map load の競合）。
  const favoriteFeatures = useAtomValue(favoriteFeaturesAtom)
  const favoriteFeaturesRef = useRef(favoriteFeatures)
  useEffect(() => { favoriteFeaturesRef.current = favoriteFeatures }, [favoriteFeatures])

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
      geojson.features = geojson.features.map((f: StationFeature) => ({
        ...f,
        properties: {
          ...f.properties,
          is_major: MAJOR_STATION_NAMES.has(f.properties.name),
        },
      }))

      geojsonRef.current = geojson

      // 30 個の fixed destination の info（coords / code / label）を geojson から動的検索。
      // geojson 内の駅名には 5 駅に括弧後缀が付与される（同名衝突回避）:
      //   田町(東京) / 大手町(東京) / 神田(東京) / 大宮(埼玉) / 押上（スカイツリー前）
      // 精确 match → 失败時は括弧 prefix 前缀マッチに fallback（半角 ( と全角 （ 両対応）。
      const destInfo: Record<string, DestInfo> = {}
      for (const meta of DESTINATIONS_META) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let matched = geojson.features.find((f: any) =>
          f.properties.name === meta.displayName || f.properties.name === meta.transitName
        )
        if (!matched) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matched = geojson.features.find((f: any) => {
            const n: string = f.properties.name
            return n.startsWith(meta.displayName + '(')
                || n.startsWith(meta.displayName + '（')
                || n.startsWith(meta.transitName + '(')
                || n.startsWith(meta.transitName + '（')
          })
        }
        if (matched) {
          const [lon, lat] = matched.geometry.coordinates
          destInfo[meta.slug] = {
            code:   matched.properties.code,
            coords: [lon, lat],
            label:  locale === 'en' ? meta.displayNameEn : meta.displayName,
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

      // 駅名ラベルの text-field — en はローマ字（未生成駅は日本語に fallback）
      const labelTextField: maplibregl.ExpressionSpecification | string = locale === 'en'
        ? ['coalesce', ['get', 'name_en'], ['get', 'name']]
        : ['get', 'name'] as maplibregl.ExpressionSpecification

      // 主要駅名ラベル（zoom >= 10、cluster 段階でも代表駅名は見える）
      map.addLayer({
        id: 'stations-label-major',
        type: 'symbol',
        source: 'stations',
        minzoom: 10,
        layout: {
          'text-field': labelTextField,
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
          'text-field': labelTextField,
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

      // ── AI 推薦 20 駅 highlight（v2、2026-05-17 追加） ──
      // 主题红外環で 20 駅を地図に常駐表示。aiCache が 24h 内 fresh の時のみ親が
      // features を非空で渡してくる。slider 連動なし（解耦設計）— maxMinutes を
      // 縮めて散点が消えても外環は残り、ユーザーが「AI 推薦 ∩ 現 slider 範囲」を
      // 視覚比較できる。
      //
      // layer order: addLayer 不指定 beforeId = 全 layer 最上層。
      // 'stations-label-major' 之前に挿入すると clusters 群がその上に乗り、
      // zoom < 11 で cluster 圆が外環を覆ってしまう（計画核査 1）。
      // 最上層に置くと label が下にくるが、label は symbol + text-halo 1.5-1.8px で
      // 可読性確保、fill 10% は label をほぼ遮らない。
      // ref から最新 features を取る — closure capture では map load 時に
      // hydrate 直後の非空 features が反映されない race を回避する。
      map.addSource('stations-ai-highlight', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: aiHighlightFeaturesRef.current },
      })
      map.addLayer({
        id: 'stations-ai-highlight',
        type: 'circle',
        source: 'stations-ai-highlight',
        paint: {
          // zoom 8-10 cluster 阶段は cluster 圆 16-36px を包圈用に大半径、
          // zoom 11+ 散点阶段は散点 r=8-9 を包圈用に小半径。
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 26, 11, 14, 16, 20],
          'circle-color': 'rgba(168, 51, 43, 0.10)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 2.4, 14, 2.8],
          'circle-stroke-color': '#a8332b',
          'circle-stroke-opacity': 0.85,
        },
      })

      // ── お気に入り駅 ★（常駐標記） ──
      // 駅点の真上に accent 藏青の ★ を symbol で描く。slider / cluster と解耦
      // （独立 source）— filter で散点が消えてもお気に入りの位置は見失わない。
      // ★ U+2605 は OpenFreeMap の 'Noto Sans Bold' glyph range (9728-9983.pbf)
      // に存在することを確認済（'Open Sans Bold' には無いので注意）。
      // text-offset は em 単位: -1.05em ≈ 散点 (r8-9px) の上縁に乗る。
      // 站名 label は下方 offset (+1.1) なので衝突しない。
      map.addSource('stations-favorites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: favoriteFeaturesRef.current },
      })
      map.addLayer({
        id: 'stations-favorites',
        type: 'symbol',
        source: 'stations-favorites',
        layout: {
          'text-field': '★',
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 11, 16, 16, 20],
          'text-offset': [0, -1.05],
          'text-anchor': 'center',
          // collision 計算から完全に外す — お気に入りは常に見える + 他 label を押し退けない
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#14365b', // --accent（globals.css palette 内、新色ではない）
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.6,
        },
      })

      // ── 駅クリック・ホバー（major/minor/unclustered 共通） ──
      const stationLayers = ['stations-major', 'stations-minor', 'clusters-unclustered']
      stationLayers.forEach(layerId => {
        map.on('click', layerId, (e) => {
          const props = e.features?.[0]?.properties
          const geo = e.features?.[0]?.geometry as unknown as PointGeom
          if (!props || !geo) return
          // MapLibre は GeoJSON properties の配列を JSON 文字列に
          // シリアライズすることがあるため、両方のケースを許容する
          let lineNames: string[] = []
          if (Array.isArray(props.line_names)) {
            lineNames = props.line_names
          } else if (typeof props.line_names === 'string' && props.line_names) {
            try { lineNames = JSON.parse(props.line_names) } catch { /* noop */ }
          }
          // 全 30 fixed destination + custom の通勤フィールドを prefix 一括コピー。
          // 旧コードでは shinjuku / shibuya / tokyo / custom の 4 つだけハードコードしていて
          // 残り 27 popular destination (meguro 等) の min_to_* が drawer に届かず
          // 「— 分 to 目黒」が表示される bug があった (2026-05-13 報告)。
          // 今後 destination を追加してもこの copy は壊れない。
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const commuteFields: Record<string, any> = {}
          for (const key of Object.keys(props)) {
            if (
              key.startsWith('min_to_') ||
              key.startsWith('transfers_to_') ||
              key.startsWith('bucket_')
            ) {
              commuteFields[key] = props[key]
            }
          }
          setSelectedStation({
            code: props.code,
            name: props.name,
            name_en: props.name_en,
            lat: geo.coordinates[1],
            lon: geo.coordinates[0],
            bucket: props.bucket,
            line_names: lineNames,
            ...commuteFields,
          })
        })
        map.on('mouseenter', layerId, (e) => {
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features?.[0]?.properties
          const geo = e.features?.[0]?.geometry as unknown as PointGeom
          if (!props || !geo) return
          const popupName = locale === 'en' ? (props.name_en ?? props.name) : props.name
          popup
            .setLngLat(geo.coordinates)
            .setHTML(`<span class="station-popup-name">${popupName}</span>`)
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
        const source = map.getSource('stations-clustered') as maplibregl.GeoJSONSource
        try {
          const zoom = await source.getClusterExpansionZoom(clusterId)
          const geo = features[0].geometry as unknown as PointGeom
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
    // map 初期化は mount 時 1 回のみ。変化する値（destination / locale 等）は別 effect・ref で
    // 反映する設計のため、deps を入れて map を再生成させない（意図的に空配列）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      label = stationLabel(customStation, locale)
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
        anchor: 'top-left',
        offset: [-16, -44],
      })
        .setLngLat(coords)
        .addTo(map)

      if (!isFirstRender.current) {
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 11), duration: 1200, essential: true })
      }
      isFirstRender.current = false
    }

  }, [destination, customStation, destInfoReady, locale])

  // ── 選択中駅 → 黒ピン更新 + 該当駅の散点/label 隠す + flyTo ──────────
  // 通勤先（赤ピン）と同一駅の場合はマーカー出さない（赤ピンが既にあるため）。
  // 散点と label を同時に隠すことで、黒ピン (anchor='top-left') と緑散点 (anchor=center)
  // が同じ lngLat に対して別アンカーで描画され「ピンが浮いて見える」現象を回避する
  // (2026-05-13 報告)。layer-level filter で実装、cluster source は影響なし。
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    selectedMarkerRef.current?.remove()
    selectedMarkerRef.current = null

    // 散点/label の filter 復元 — selectedStation 解除時、または下記の早期 return パスでも
    // 統一的に呼ぶため、まず復元してから条件分岐に進む。
    const restoreFilters = () => {
      if (!map.getLayer('stations-major')) return
      map.setFilter('stations-major',       ['==', ['get', 'is_major'], true])
      map.setFilter('stations-minor',       ['==', ['get', 'is_major'], false])
      map.setFilter('stations-label-major', ['==', ['get', 'is_major'], true])
      map.setFilter('stations-label',       ['==', ['get', 'is_major'], false])
    }

    if (!selectedStation) {
      restoreFilters()
      return
    }

    // 通勤先と同じコードならば赤ピンに任せて黒ピンは出さない。
    // この場合は散点も隠さない（赤ピンが上に乗っているので問題ない）。
    const destCode = destination === 'custom'
      ? customStation?.code
      : destInfoRef.current[destination]?.code
    if (destCode != null && selectedStation.code === destCode) {
      restoreFilters()
      return
    }

    // 該当 station code を 4 layer 全てから排除（散点 + 名前ラベル）
    if (map.getLayer('stations-major')) {
      const code = selectedStation.code
      map.setFilter('stations-major',       ['all', ['==', ['get', 'is_major'], true],  ['!=', ['get', 'code'], code]])
      map.setFilter('stations-minor',       ['all', ['==', ['get', 'is_major'], false], ['!=', ['get', 'code'], code]])
      map.setFilter('stations-label-major', ['all', ['==', ['get', 'is_major'], true],  ['!=', ['get', 'code'], code]])
      map.setFilter('stations-label',       ['all', ['==', ['get', 'is_major'], false], ['!=', ['get', 'code'], code]])
    }

    const coords: [number, number] = [selectedStation.lon, selectedStation.lat]
    selectedMarkerRef.current = new maplibregl.Marker({
      element: createSelectedPinElement(stationLabel(selectedStation, locale)),
      anchor:  'top-left',
      offset:  [-16, -44],
    })
      .setLngLat(coords)
      .addTo(map)

    // 選択駅へ常に flyTo して center に寄せる（以前は inView 時 skip していたが、
    // AI 推薦から飛んできた駅 / 抽屉に隠れた駅が「見えない」問題を生むため毎回動かす）。
    // map.loaded() 守卫は外す — destination effect の flyTo は守卫なしで動いているし、
    // selectedStation が set されるタイミングでは既に style load 済みのため安全。
    // 桌面端は抽屉 380px が右側を占有するため、offset で center を左へずらして
    // pin を抽屉左側 viewport の視覚中心に置く。モバイル抽屉は全幅なので offset 不要。
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640
    map.flyTo({
      center:   coords,
      zoom:     Math.max(map.getZoom(), 12),
      duration: 1000,
      essential: true,
      offset:   isDesktop ? [-190, 0] : [0, 0],
    })
  }, [selectedStation, destination, customStation, destInfoReady, locale])

  // ── AI highlight features 更新 ──
  // aiCache が新しく確定 / 失効 / リコール時に aiHighlightFeaturesAtom が変わる。
  // race 対策: source 未生成時 (map.on('load') 完了前) は addSource 後の 'sourcedata'
  // イベントで retry する。'idle' イベントは tile / font の 404 等で発火タイミングが
  // 不安定なため避ける（atomWithStorage hydrate と map load の race で発覚）。
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = (): boolean => {
      const src = map.getSource('stations-ai-highlight') as maplibregl.GeoJSONSource | undefined
      if (!src) return false
      src.setData({ type: 'FeatureCollection', features: aiHighlightFeatures })
      return true
    }

    if (apply()) return
    // source 未生成 → 後続の sourcedata / styledata イベントで retry
    // （addSource は map.on('load') 内で実行されるため、いずれかが発火する）。
    const onData = () => {
      if (apply()) {
        map.off('sourcedata', onData)
        map.off('styledata', onData)
      }
    }
    map.on('sourcedata', onData)
    map.on('styledata', onData)
    return () => {
      map.off('sourcedata', onData)
      map.off('styledata', onData)
    }
  }, [aiHighlightFeatures])

  // ── お気に入り ★ features 更新 ──
  // toggle / bootstrap 復元で favoriteFeaturesAtom が変わる度に source を更新。
  // race 対策は AI highlight と同一パターン（sourcedata / styledata retry）。
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = (): boolean => {
      const src = map.getSource('stations-favorites') as maplibregl.GeoJSONSource | undefined
      if (!src) return false
      src.setData({ type: 'FeatureCollection', features: favoriteFeatures })
      return true
    }

    if (apply()) return
    const onData = () => {
      if (apply()) {
        map.off('sourcedata', onData)
        map.off('styledata', onData)
      }
    }
    map.on('sourcedata', onData)
    map.on('styledata', onData)
    return () => {
      map.off('sourcedata', onData)
      map.off('styledata', onData)
    }
  }, [favoriteFeatures])

  return <div ref={containerRef} className="w-full h-full" />
}
