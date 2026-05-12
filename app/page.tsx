'use client'
import { useState, useEffect } from 'react'
import MapView from '@/components/MapView'
import TimeSlider from '@/components/TimeSlider'
import DestinationPicker from '@/components/DestinationPicker'
import StationDrawer from '@/components/StationDrawer'
import TransferFilter from '@/components/TransferFilter'
import WelcomeOverlay from '@/components/WelcomeOverlay'
import LoadingOverlay from '@/components/LoadingOverlay'
import Story from '@/components/Story'
import Legend from '@/components/Legend'
import HeaderMenu from '@/components/HeaderMenu'
import CookieConsent from '@/components/CookieConsent'
import DestinationAsk from '@/components/DestinationAsk'
import { supabase } from '@/lib/supabase'
import type { SuumoStationMap, SuumoStationEntry } from '@/lib/affiliate'
import { loadManualRentData, type RentMap } from '@/lib/manual-rent'
import { loadGovernmentRentData, type GovernmentRentMap } from '@/lib/government-rent'
import { loadLineStyles, type LineStyleMap } from '@/lib/line-styles'
import {
  type Destination,
  type FixedDestination,
  isFixedDestination,
} from '@/lib/destinations'
import { prepareGraph, type GraphData, type PreparedGraph } from '@/lib/dijkstra'

export type { Destination, FixedDestination } from '@/lib/destinations'

const VISITED_KEY = 'tcm.visited.v1'
// DestinationAsk で選ばれた通勤先を保存。リピート訪問時は復元して
// 「もう一度通勤先を聞かれる」体験を回避する。
const DESTINATION_KEY = 'tcm.destination.v1'

export type ConsensusEntry = { min: number; count: number }
export type ConsensusMap = Record<
  number,
  Partial<Record<FixedDestination, ConsensusEntry>>
>

export interface CustomStation {
  code: number
  name: string
  lat: number
  lon: number
}

// 30 個の fixed destination ごとに自動生成される通勤時間フィールド。
// build_stations_geojson_v3.py がこれらを stations.geojson の properties に書き出す。
type CommuteFields = {
  [K in FixedDestination as `min_to_${K}`]?:       number
} & {
  [K in FixedDestination as `transfers_to_${K}`]?: number
} & {
  [K in FixedDestination as `bucket_${K}`]?:       number
} & {
  // custom destination は client 側で別途算出されることがある
  min_to_custom?:       number
  transfers_to_custom?: number
}

export interface Station extends CommuteFields {
  code:   number
  name:   string
  lat:    number
  lon:    number
  bucket: number  // shinjuku ベースのデフォルト bucket
  line_names?: string[]  // 所属路線名（build_stations_geojson_v3.py が station_database から注入）
}

export default function Home() {
  const [destination, setDestination] = useState<Destination>('shinjuku')
  const [maxMinutes, setMaxMinutes] = useState(45)
  const [maxTransfers, setMaxTransfers] = useState(99)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [customStation, setCustomStation] = useState<CustomStation | null>(null)
  const [stationList, setStationList] = useState<CustomStation[]>([])
  const [consensus, setConsensus] = useState<ConsensusMap>({})
  const [suumoMap, setSuumoMap] = useState<SuumoStationMap | null>(null)
  // 手動収録家賃データ（101 駅、SUUMO 駅別相場ページから取得）
  const [rentMap, setRentMap] = useState<RentMap>({})
  // 政府住宅統計家賃データ（1940 駅、市区町村粒度の baseline）
  const [governmentRent, setGovernmentRent] = useState<GovernmentRentMap>({})
  // 路線スタイル map（線路名 → {color, symbol}）。主要路線 DetailRow の色条用。
  const [lineStyles, setLineStyles] = useState<LineStyleMap>({})
  // クライアント側 Dijkstra 用グラフ。カスタム目的地で haversine を置き換える。
  // 未ロード中は null（MapView 側で fallback として haversine が動作）。
  const [graph, setGraph] = useState<PreparedGraph | null>(null)

  // Welcome → Story → Map handshake (README §5)
  // - welcomeOpen : true 表示 Welcome 浮层
  // - storyOpen   : true 表示 Story 浮层
  // - mapMounted  : 一度 true になったら false に戻さない（防闪屏）
  // 初回判定中は null（SSR / hydration 安全）。
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [destinationAskOpen, setDestinationAskOpen] = useState(false)
  // DestinationAsk が fade in 中（Welcome/Story の fade out と重なる時間帯）。
  // この間は z=82 の curtain で地図を覆って、両 overlay の opacity が混じる
  // 瞬間に下層の地図が「闪现」するのを防ぐ。
  const [destinationAskFadeIn, setDestinationAskFadeIn] = useState(false)
  const [mapMounted, setMapMounted] = useState(false)
  // 地図加载画面の状態。loaderVisible は fade in/out を 1 つの CSS トランジションで制御し、
  // loaderMounted は DOM 上の mount/unmount を記録する（fade out 完了後に外す）。
  // mapReady = MapView が初回 idle を発火した（タイル＋レイヤ描画完了）。
  const [loaderMounted, setLoaderMounted] = useState(false)
  const [loaderVisible, setLoaderVisible] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // localStorage 読み取り（初回のみ）
  useEffect(() => {
    let visited = false
    try { visited = localStorage.getItem(VISITED_KEY) === '1' } catch {}
    setWelcomeOpen(!visited)
    // 一度訪問済みのユーザーはマップを直接マウント、かつ保存済みの通勤先を復元
    if (visited) {
      setMapMounted(true)
      // 加载画面 — タイル取得中の白画面を覆う
      setLoaderMounted(true)
      setLoaderVisible(true)
      try {
        const stored = localStorage.getItem(DESTINATION_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as
            | { type: 'custom'; station: CustomStation }
            | { type: 'default'; dest: Exclude<Destination, 'custom'> }
          if (parsed.type === 'custom' && parsed.station) {
            setDestination('custom')
            setCustomStation(parsed.station)
          } else if (parsed.type === 'default' && isFixedDestination(parsed.dest)) {
            setDestination(parsed.dest)
          }
        }
      } catch {}
    }
  }, [])

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

  // graph.json （カスタム目的地用 adjacency graph）の遅延ロード。
  // 失敗時は graph=null のまま、MapView は haversine fallback で動作する。
  useEffect(() => {
    fetch('/data/graph.json')
      .then(r => r.ok ? r.json() as Promise<GraphData> : Promise.reject(new Error('graph not available')))
      .then(raw => setGraph(prepareGraph(raw)))
      .catch(() => {
        // graph 未配信時は haversine fallback。あえてエラーログを出さない。
      })
  }, [])

  // SUUMO 駅 deep link 用マップを scripts/build_suumo_station_map.py の出力から読み込む。
  // ファイル未生成（クロール未実行）の場合は 404 で suumoMap が null のまま、
  // affiliate.ts 側で SUUMO 賃貸トップへの fallback が走る（壊れない）。
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
        // suumo map 未配信時は SUUMO トップへの fallback で動作するため何もしない
      })
  }, [])

  // 手動収録家賃データ（101 駅）。未収録 station は空 dict にフォールバック。
  useEffect(() => {
    loadManualRentData().then(data => {
      if (data?.stations) setRentMap(data.stations)
    })
  }, [])

  // 政府住宅統計家賃データ（1940 駅 baseline）。SUUMO 未収録駅の fallback 用。
  useEffect(() => {
    loadGovernmentRentData().then(data => {
      if (data?.stations) setGovernmentRent(data.stations)
    })
  }, [])

  // 路線スタイル（color/symbol）map。未取得時は空 dict、StationDrawer 側で fallback 色。
  useEffect(() => {
    loadLineStyles().then(map => {
      if (map) setLineStyles(map)
    })
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

  function persistVisited() {
    try { localStorage.setItem(VISITED_KEY, '1') } catch {}
  }

  // Welcome → Map / Story 遷移は、Welcome の fade out アニメーション (≈900ms)
  // と次のレイヤーの fade in を重ねる必要がある。Welcome を即座に unmount
  // すると下層の地図 / Story がまだ opacity 0 で背景が一瞬透ける（闪现）。
  // ⇒ 次のレイヤーを先に mount し、Welcome は ~900ms 後に外す。
  const WELCOME_FADE_MS = 900

  // Welcome / Story の「地図へ」CTA — DestinationAsk を経由してから Map へ。
  // mapMounted はここでは true にせず、DestinationAsk で確定したタイミングで上げる。
  function handleEnterMap() {
    persistVisited()
    setDestinationAskOpen(true)
    setDestinationAskFadeIn(true)  // curtain を z=82 に出す
    window.setTimeout(() => {
      setStoryOpen(false)
      setWelcomeOpen(false)
      setDestinationAskFadeIn(false)  // fade in 完了 → curtain を外す
    }, WELCOME_FADE_MS)
  }

  // StationDrawer から「ここを通勤先にする」ボタン押下時の処理。
  // 駅を custom destination として設定 + localStorage 保存 + drawer を閉じて
  // 地図の再色付けに集中させる。比較フローでユーザが連続的に試せるよう設計。
  function handleSetAsDestination(station: Station) {
    const custom: CustomStation = {
      code: station.code,
      name: station.name,
      lat:  station.lat,
      lon:  station.lon,
    }
    setCustomStation(custom)
    setDestination('custom')
    try {
      localStorage.setItem(DESTINATION_KEY, JSON.stringify({ type: 'custom', station: custom }))
    } catch {}
    setSelectedStation(null)
  }

  // DestinationAsk から通勤先確定が返ってきた時の処理。
  // destination / customStation を反映 + localStorage に保存 + map をマウント。
  function handleConfirmDestination(dest: Destination, custom: CustomStation | null) {
    if (dest === 'custom' && custom) {
      setCustomStation(custom)
      setDestination('custom')
    } else {
      setDestination(dest)
      setCustomStation(null)
    }
    try {
      const payload = dest === 'custom' && custom
        ? { type: 'custom' as const, station: custom }
        : { type: 'default' as const, dest }
      localStorage.setItem(DESTINATION_KEY, JSON.stringify(payload))
    } catch {}
    setMapMounted(true)
    // 加载画面を表示して地図の初期タイル読み込みを覆う。
    setLoaderMounted(true)
    setLoaderVisible(true)
    // 既に地図が ready 済みの場合（再訪問・主页 → DestinationAsk → 再入場）は
    // MapView が remount しないので map.once('idle', ...) が再発火しない。
    // 手動で fade out を schedule して loader が卡死しないようにする。
    // 初回訪問時は mapReady=false で handleMapReady の onReady で自動 fade される。
    if (mapReady) {
      window.setTimeout(() => setLoaderVisible(false), 800)
      window.setTimeout(() => setLoaderMounted(false), 800 + 1200)
    }
    // DestinationAsk 自身の fade out アニメ完了後に unmount
    window.setTimeout(() => setDestinationAskOpen(false), WELCOME_FADE_MS)
  }

  // MapView から ready 通知。加載画面を ~500ms グレースしてから fade out、
  // 1.1s で opacity 0 になったら DOM を unmount。地図本体は mapReady に乗って
  // opacity 0→1 にクロスフェードして現れる。
  function handleMapReady() {
    if (mapReady) return
    setMapReady(true)
    window.setTimeout(() => setLoaderVisible(false), 500)
    window.setTimeout(() => setLoaderMounted(false), 500 + 1200)
  }

  // Welcome の Ghost CTA — Story を開く（マップはまだマウントしない）
  function handleEnterStory() {
    persistVisited()
    setStoryOpen(true)
    window.setTimeout(() => setWelcomeOpen(false), WELCOME_FADE_MS)
  }

  // Story → Welcome 戻り遷移も同様に重ねる。Welcome を先に mount し、
  // Story は ~900ms 後に外す。両方が同時に open している間は curtain で
  // 地図を隠す。
  function handleStoryBack() {
    setWelcomeOpen(true)
    window.setTimeout(() => setStoryOpen(false), WELCOME_FADE_MS)
  }

  // Help ボタン — Welcome を再表示（mapMounted は維持）
  function handleHelpClick() {
    setWelcomeOpen(true)
  }

  return (
    <>
      <main className="relative w-full h-full bg-sp-bg">
        {/* マップは一度 mount したら以降ずっと表示。Welcome/Story 中はオーバーレイで覆う。 */}
        {mapMounted && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: mapReady ? 1 : 0,
                transform: mapReady ? 'scale(1)' : 'scale(1.015)',
                transformOrigin: 'center center',
                transition:
                  'opacity 1.2s cubic-bezier(.2,.8,.2,1), transform 1.6s cubic-bezier(.2,.8,.2,1)',
                willChange: 'opacity, transform',
              }}
            >
              <MapView
                destination={destination}
                maxMinutes={maxMinutes}
                maxTransfers={maxTransfers}
                onStationClick={setSelectedStation}
                customStation={customStation}
                graph={graph}
                onReady={handleMapReady}
              />
            </div>

            {/* 顶部控制栏 — README §4.3 glass card
                glass-top class が safe-area-inset 込みの top/left/right を担当 */}
            <div className="glass-top absolute
                            z-10 flex flex-col md:flex-row md:items-center
                            gap-2 md:gap-4
                            rounded-2xl px-4 md:px-6 py-3
                            border border-black/[.07]
                            shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_32px_rgba(0,0,0,.10)]"
                 style={{
                   background: 'rgba(244, 241, 234, 0.78)',
                   backdropFilter: 'blur(20px) saturate(160%)',
                   WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                 }}>
              <DestinationPicker
                value={destination}
                onChange={handleDestinationChange}
                stationList={stationList}
                customStation={customStation}
                onCustomChange={handleCustomChange}
              />

              <div className="hidden md:block w-px h-6 bg-ed-ink/15" />
              <div className="md:hidden h-px bg-ed-ink/10" />

              <div className="flex items-center gap-3">
                <TimeSlider value={maxMinutes} onChange={setMaxMinutes} />
                <div className="w-px h-5 bg-ed-ink/15" />
                <TransferFilter value={maxTransfers} onChange={setMaxTransfers} />
              </div>
            </div>

            <Legend maxMinutes={maxMinutes} />

            <StationDrawer
              station={selectedStation}
              destination={destination}
              customStation={customStation}
              consensus={consensus}
              suumoMap={suumoMap}
              rentMap={rentMap}
              governmentRent={governmentRent}
              lineStyles={lineStyles}
              onSetAsDestination={handleSetAsDestination}
              onClose={() => setSelectedStation(null)}
            />

            <HeaderMenu onHelp={handleHelpClick} />
            <CookieConsent />
          </>
        )}
      </main>

      {/* curtain — Welcome ↔ Story 過渡中、地図が隙間から透けないよう
          常に不透明な cream の地板を z=80 に敷く。両 overlay が同時に
          open している瞬間だけ存在。 */}
      {welcomeOpen === true && storyOpen && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: '#f3ecdd',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* curtain — Welcome/Story → DestinationAsk 過渡中、両者の opacity が
          混じる瞬間に下層の地図が透けるのを防ぐ。z=82 (Map=base, DestinationAsk=85,
          Welcome=100 の間)。fade in 完了後に自動的に外れる。 */}
      {destinationAskFadeIn && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 82,
            background: '#f3ecdd',
            pointerEvents: 'none',
          }}
        />
      )}

      {welcomeOpen === true && (
        <WelcomeOverlay
          onEnterMap={handleEnterMap}
          onEnterStory={handleEnterStory}
        />
      )}

      {storyOpen && (
        <Story
          onEnterMap={handleEnterMap}
          onBack={handleStoryBack}
        />
      )}

      {destinationAskOpen && (
        <DestinationAsk
          stationList={stationList}
          onConfirm={handleConfirmDestination}
        />
      )}

      {/* 加載画面 — MapView の onReady 発火後 ~1.7s で fade out + unmount */}
      {loaderMounted && <LoadingOverlay visible={loaderVisible} />}
    </>
  )
}
