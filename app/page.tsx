'use client'
import { useState, useEffect } from 'react'
import MapView from '@/components/MapView'
import TimeSlider from '@/components/TimeSlider'
import DestinationPicker from '@/components/DestinationPicker'
import StationDrawer from '@/components/StationDrawer'
import TransferFilter from '@/components/TransferFilter'
import WelcomeOverlay from '@/components/WelcomeOverlay'
import Story from '@/components/Story'
import Legend from '@/components/Legend'
import HelpButton from '@/components/HelpButton'
import LegalLink from '@/components/LegalLink'
import CookieConsent from '@/components/CookieConsent'
import DestinationAsk from '@/components/DestinationAsk'
import { supabase } from '@/lib/supabase'
import type { SuumoStationMap, SuumoStationEntry } from '@/lib/affiliate'

const VISITED_KEY = 'tcm.visited.v1'
// DestinationAsk で選ばれた通勤先を保存。リピート訪問時は復元して
// 「もう一度通勤先を聞かれる」体験を回避する。
const DESTINATION_KEY = 'tcm.destination.v1'

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
  const [suumoMap, setSuumoMap] = useState<SuumoStationMap | null>(null)

  // Welcome → Story → Map handshake (README §5)
  // - welcomeOpen : true 表示 Welcome 浮层
  // - storyOpen   : true 表示 Story 浮层
  // - mapMounted  : 一度 true になったら false に戻さない（防闪屏）
  // 初回判定中は null（SSR / hydration 安全）。
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [destinationAskOpen, setDestinationAskOpen] = useState(false)
  const [mapMounted, setMapMounted] = useState(false)

  // localStorage 読み取り（初回のみ）
  useEffect(() => {
    let visited = false
    try { visited = localStorage.getItem(VISITED_KEY) === '1' } catch {}
    setWelcomeOpen(!visited)
    // 一度訪問済みのユーザーはマップを直接マウント、かつ保存済みの通勤先を復元
    if (visited) {
      setMapMounted(true)
      try {
        const stored = localStorage.getItem(DESTINATION_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as
            | { type: 'custom'; station: CustomStation }
            | { type: 'default'; dest: Exclude<Destination, 'custom'> }
          if (parsed.type === 'custom' && parsed.station) {
            setDestination('custom')
            setCustomStation(parsed.station)
          } else if (
            parsed.type === 'default' &&
            (parsed.dest === 'shinjuku' || parsed.dest === 'shibuya' || parsed.dest === 'tokyo')
          ) {
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
    window.setTimeout(() => {
      setStoryOpen(false)
      setWelcomeOpen(false)
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
    // DestinationAsk 自身の fade out アニメ完了後に unmount
    window.setTimeout(() => setDestinationAskOpen(false), WELCOME_FADE_MS)
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
            <MapView
              destination={destination}
              maxMinutes={maxMinutes}
              maxTransfers={maxTransfers}
              onStationClick={setSelectedStation}
              customStation={customStation}
            />

            {/* 顶部控制栏 — README §4.3 glass card */}
            <div className="absolute top-3 left-3 right-3
                            md:top-5 md:left-1/2 md:right-auto md:-translate-x-1/2
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
              onSetAsDestination={handleSetAsDestination}
              onClose={() => setSelectedStation(null)}
            />

            <HelpButton onClick={handleHelpClick} />
            <LegalLink />
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
    </>
  )
}
