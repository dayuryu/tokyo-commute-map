'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useLocale } from 'next-intl'
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
import AiWizard from '@/components/AiWizard'
import AiRecallButton from '@/components/AiRecallButton'
import type { FixedDestination as FixedDestinationType } from '@/lib/destinations'
import type { Recommendation } from '@/lib/ai-recommend/types'
import { computeCommutes } from '@/lib/dijkstra'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { ONE_DAY_MS, OVERLAY_FADE_MS } from '@/lib/constants'
import { selectedStationAtom } from '@/lib/atoms/ui'
import { stationByNameAtom, graphAtom } from '@/lib/atoms/data'
import {
  destinationAtom,
  customStationAtom,
  setDestinationAtom,
} from '@/lib/atoms/domain'
import { useDataLoaders } from '@/hooks/useDataLoaders'
import { useBootstrapDestination } from '@/hooks/useBootstrap'
import type {
  CustomCommutesMap,
  CustomStation,
  Destination,
  Station,
  WizardDestination,
} from '@/lib/types'

interface AiCache {
  /** 30 fixed slug、または 'custom' (custom destination 指定時) */
  destination:   FixedDestinationType | 'custom'
  /** destination === 'custom' の時に保持する station 情報。fixed 時は undefined。 */
  customStation?: CustomStation
  recs:          Recommendation[]
  usedAt:        string  // ISO timestamp、真調用が完了した時刻
}

/** 24h 以内に新規推薦を行ったか判定（recall 制限の判定に使用） */
function isAiCacheFresh(c: AiCache | null): boolean {
  if (!c) return false
  const ageMs = Date.now() - new Date(c.usedAt).getTime()
  return ageMs < ONE_DAY_MS
}

/** Wizard の起動モード — false=閉、'new'=新規 6 問、'recall'=キャッシュから result phase 直起動 */
type WizardOpenMode = false | 'new' | 'recall'

export default function Home() {
  const locale = useLocale()
  // destination / customStation は lib/atoms/domain.ts に移行。書き込みは setDestinationAtom
  // を経由する 1 経路のみ — destination ⟺ customStation の不変量と localStorage 永続化
  // は atom 層で構造的に保たれる（ADR-0003 P3）。
  const destination = useAtomValue(destinationAtom)
  const customStation = useAtomValue(customStationAtom)
  const setDestination = useSetAtom(setDestinationAtom)
  // maxMinutes / maxTransfers は lib/atoms/ui.ts に移行（子 component が直接購読）。
  // selectedStation は atom 化したが、page 側も aiRecallAvailable 算出と各 handler の
  // 更新で参照するため、ここで読み取り + setter を取得する。
  const selectedStation = useAtomValue(selectedStationAtom)
  const setSelectedStation = useSetAtom(selectedStationAtom)
  // 初回 mount で localStorage から destination を復元（atom 経路で persist:false）。
  useBootstrapDestination()

  // データ加載層は lib/atoms/data.ts + hooks/useDataLoaders に移行。消費 component
  // （StationDrawer / DestinationPicker / AiWizard / DestinationAsk）は各 atom を
  // 直接購読する。page 側で読むのは派生 useMemo が依存する 2 つのみ：
  // - stationByName: aiHighlightFeatures + handleWizardResolve の駅名 lookup
  // - graph: customCommutes の Dijkstra 入力
  useDataLoaders(locale)
  const stationByName = useAtomValue(stationByNameAtom)
  const graph = useAtomValue(graphAtom)

  // custom destination 時の 1843 駅 → custom 駅 通勤 map。
  // MapView の paint property と StationDrawer の通勤時間表示の両方で使う single source of truth。
  // customStation / graph が変化したときのみ再計算（maxMinutes スライダー操作では走らない）。
  const customCommutes = useMemo<CustomCommutesMap>(() => {
    if (!customStation || !graph) return null
    return computeCommutes(graph, customStation.code)
  }, [customStation, graph])

  // Welcome → Story → Map handshake (README §5)
  // - welcomeOpen : true 表示 Welcome 浮层
  // - storyOpen   : true 表示 Story 浮层
  // - mapMounted  : 一度 true になったら false に戻さない（防闪屏）
  // 初回判定中は null（SSR / hydration 安全）。
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [destinationAskOpen, setDestinationAskOpen] = useState(false)
  // AI Wizard 表示制御。'new' = 新規 wizard、'recall' = キャッシュから result 直起動。
  const [wizardOpen, setWizardOpen] = useState<WizardOpenMode>(false)
  // AI 推薦の最新キャッシュ（recs + destination + usedAt）。
  // 真調用完了後に保存、 localStorage 同期。リコール経路で wizard に渡す。
  const [aiCache, setAiCache] = useState<AiCache | null>(null)
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

  // AI 推薦 20 駅の地図 highlight 用 features。aiCache が 24h 内 fresh な時のみ非空。
  // MapView の `stations-ai-highlight` source に setData される。
  const aiHighlightFeatures = useMemo<GeoJSON.Feature[]>(() => {
    if (!isAiCacheFresh(aiCache)) return []
    // stationByName は geojson fetch 完了後に setState される。未 ready 時に
    // lookup を走らせると 20 駅全 miss で console.warn が 20 件出るのを防ぐため、
    // 空 dict の段階では空 features で待つ（後の re-render で正しく算出される）。
    if (Object.keys(stationByName).length === 0) return []
    // destination が aiCache 生成時と一致しない場合は highlight を表示しない。
    // ユーザーが地図上で通勤先を切り替えた後、過去の AI 推薦に基づく赤外環が
    // 残ったままだと「今の通勤先に対する推薦」と誤読される UX 問題があるため
    // (2026-05-17 報告)。AiRecallButton は引き続き表示され、ユーザーが押すと
    // Wizard recall 経由で destination が aiCache 対応値に戻り、highlight も復活する。
    const cacheDestMatches = aiCache!.destination === 'custom'
      ? (destination === 'custom' && customStation?.code === aiCache!.customStation?.code)
      : destination === aiCache!.destination
    if (!cacheDestMatches) return []
    const features: GeoJSON.Feature[] = []
    aiCache!.recs.forEach((r, idx) => {
      const s = stationByName[r.station_name]
      // backend `lib/ai-recommend/openai.ts:39-70` で validNames 厳格 filter 済み、
      // geojson 内同名 5 駅は括弧後缀で消歧済み（田町(東京) 等）。理論 100% 命中。
      // TODO v2.1: backend に station_code を返させて stationByCode lookup に切替、
      //           未消歧同名駅の歧義を根絶。
      if (!s) {
        console.warn(`[ai-highlight] stationByName miss for "${r.station_name}"`)
        return
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { code: s.code, name: s.name, rank: idx + 1 },
      })
    })
    return features
  }, [aiCache, stationByName, destination, customStation])

  // localStorage 読み取り（初回のみ）
  useEffect(() => {
    let visited = false
    try { visited = localStorage.getItem(STORAGE_KEYS.visited) === '1' } catch {}
    // 言語切替直後の強制 Welcome 表示 — flag は読んだ後即消費（1-shot）。
    let forceWelcome = false
    try {
      if (sessionStorage.getItem(STORAGE_KEYS.welcomeAfterLocaleSwitch) === '1') {
        forceWelcome = true
        sessionStorage.removeItem(STORAGE_KEYS.welcomeAfterLocaleSwitch)
      }
    } catch {}
    setWelcomeOpen(!visited || forceWelcome)
    // AI cache 復元 — 古い・壊れたデータは silent ignore
    // v1 形式 (custom 非対応) も互換: destination が fixed slug の旧 entry はそのまま読める。
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.aiCache)
      if (raw) {
        const parsed = JSON.parse(raw) as AiCache
        const baseOk = parsed?.recs?.length && parsed.destination && parsed.usedAt
        // custom destination は customStation 必須、無ければ壊れた entry として無視
        const customOk = parsed?.destination !== 'custom' ||
          (parsed.customStation && typeof parsed.customStation.code === 'number')
        if (baseOk && customOk) {
          setAiCache(parsed)
        }
      }
    } catch {}
    // 一度訪問済みのユーザーはマップを直接マウント（destination 復元は useBootstrapDestination が担当）。
    // ただし forceWelcome の時は Welcome を見せる優先度が上なので skip。
    if (visited && !forceWelcome) {
      setMapMounted(true)
      // 加载画面 — タイル取得中の白画面を覆う
      setLoaderMounted(true)
      setLoaderVisible(true)
    }
  }, [])

  function persistVisited() {
    try { localStorage.setItem(STORAGE_KEYS.visited, '1') } catch {}
  }

  // Welcome → Map / Story 遷移は、Welcome の fade out アニメーション (≈900ms)
  // と次のレイヤーの fade in を重ねる必要がある。Welcome を即座に unmount
  // すると下層の地図 / Story がまだ opacity 0 で背景が一瞬透ける（闪现）。
  // ⇒ 次のレイヤーを先に mount し、Welcome は OVERLAY_FADE_MS 後に外す。
  // (OVERLAY_FADE_MS は lib/constants.ts、globals.css の transition 値と同期)

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
    }, OVERLAY_FADE_MS)
  }

  // StationDrawer から「ここを通勤先にする」ボタン押下時の処理。
  // setDestinationAtom が atom 更新 + localStorage 保存をアトミックに行う。
  // drawer を閉じて地図の再色付けに集中させる。比較フローでユーザが連続的に試せる設計。
  function handleSetAsDestination(station: Station) {
    const custom: CustomStation = {
      code: station.code,
      name: station.name,
      lat:  station.lat,
      lon:  station.lon,
    }
    setDestination({ kind: 'custom', station: custom })
    setSelectedStation(null)
  }

  // DestinationAsk から通勤先確定が返ってきた時の処理。
  // setDestinationAtom が atom 更新 + localStorage 保存をアトミックに行う。map マウントは別途。
  function handleConfirmDestination(dest: Destination, custom: CustomStation | null) {
    if (dest === 'custom' && custom) {
      setDestination({ kind: 'custom', station: custom })
    } else if (dest !== 'custom') {
      setDestination({ kind: 'fixed', slug: dest })
    }
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
    window.setTimeout(() => setDestinationAskOpen(false), OVERLAY_FADE_MS)
  }

  // ── AI Wizard 関連 handler ──────────────────────────────────────
  // DestinationAsk の AI hero CTA「新規 AI に提案してもらう」から呼ばれる。
  // 24h 以内に既に新規推薦を行っていれば silent ignore（DestinationAsk 側で disable してあるはず）。
  function handleStartWizard() {
    if (isAiCacheFresh(aiCache)) {
      // 防御 — 通常 DestinationAsk が disable しているのでここには来ない
      return
    }
    persistVisited()
    // AI wizard は全画面フロー。開いている駅 drawer を閉じておく
    // （wizard 完了後に地図へ戻った際、旧 drawer が残る UX 不整合を防ぐ）。
    setSelectedStation(null)
    setWizardOpen('new')
    window.setTimeout(() => setDestinationAskOpen(false), OVERLAY_FADE_MS)
  }

  // DestinationAsk の「過去の推薦を再表示」/ 地図上の AiRecallButton から呼ばれる。
  // aiCache が無ければ silent ignore。Wizard を recall モードで起動 = result phase 直起動。
  function handleRecallWizard() {
    if (!aiCache) return
    persistVisited()
    // 同上 — recall でも開いている駅 drawer は閉じる。
    setSelectedStation(null)
    setWizardOpen('recall')
    if (destinationAskOpen) {
      window.setTimeout(() => setDestinationAskOpen(false), OVERLAY_FADE_MS)
    }
  }

  // StationDrawer 内「← AI 推薦 20 駅に戻る」リンク押下時 — drawer を閉じて Wizard を recall 起動。
  // aiCache が無い場合は防御的 silent ignore（通常 drawer がリンク自体を出さないはず）。
  function handleRecallAiFromDrawer() {
    if (!aiCache) return
    setSelectedStation(null)
    handleRecallWizard()
  }

  // AiWizard から推薦結果が確定した瞬間に呼ばれる（真調用 / fallback / cache 命中いずれも）。
  // 親側で aiCache 更新 + localStorage 永続化。リコール起動の場合は呼ばれない（既に持っているため）。
  function handleAiResultReady(dest: WizardDestination, recs: Recommendation[]) {
    const next: AiCache = dest.kind === 'fixed'
      ? { destination: dest.slug, recs, usedAt: new Date().toISOString() }
      : { destination: 'custom', customStation: dest.station, recs, usedAt: new Date().toISOString() }
    setAiCache(next)
    try {
      localStorage.setItem(STORAGE_KEYS.aiCache, JSON.stringify(next))
    } catch {}
  }

  // Wizard を閉じる（取消、または結果 CTA「地図で見比べる」押下）。
  // 地図を mount + loader fade で表示し Wizard を fade out で外す。
  // dest が null（Q1 まで進まずに閉じた）の場合は現在の destination を維持する。
  function handleWizardClose(dest: WizardDestination | null) {
    if (dest) setDestination(dest)
    if (!mapMounted) {
      setMapMounted(true)
      setLoaderMounted(true)
      setLoaderVisible(true)
    } else if (mapReady) {
      // 既に Map / loader が ready の場合、loader は出ているなら fade out、
      // 出ていなければそのまま地図表示。
    }
    if (mapReady && loaderVisible) {
      window.setTimeout(() => setLoaderVisible(false), 600)
      window.setTimeout(() => setLoaderMounted(false), 600 + 1200)
    }
    window.setTimeout(() => setWizardOpen(false), OVERLAY_FADE_MS)
  }

  // 結果カードクリック — destination を反映 + 該当駅の drawer を即時 open。
  // Backend openai.ts は候補 list の name に厳密一致するもののみ通す設計だが、
  // 万一 stationByName lookup が miss した場合は close 経路に縮退して地図のみ表示する
  // （ユーザが card クリックしたのに何も起きない silent failure を回避）。
  function handleWizardResolve(dest: WizardDestination, stationName: string) {
    const found = stationByName[stationName] ?? null
    if (!found) {
      console.warn(`[Wizard] stationByName miss for "${stationName}", falling back to close`)
      handleWizardClose(dest)
      return
    }
    setDestination(dest)
    if (!mapMounted) {
      setMapMounted(true)
      setLoaderMounted(true)
      setLoaderVisible(true)
    }
    // AiWizard.handleResolve 側で既に 700ms closing fade を消費しているため、
    // ここでは即時に drawer 開 + wizard unmount。以前は更に 900ms (OVERLAY_FADE_MS)
    // 待っていて、合計 1.6s「点击 → 飛び始め」の遅延体感を生んでいた (報告)。
    setSelectedStation(found)
    setWizardOpen(false)
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
    window.setTimeout(() => setWelcomeOpen(false), OVERLAY_FADE_MS)
  }

  // Story → Welcome 戻り遷移も同様に重ねる。Welcome を先に mount し、
  // Story は ~900ms 後に外す。両方が同時に open している間は curtain で
  // 地図を隠す。
  function handleStoryBack() {
    setWelcomeOpen(true)
    window.setTimeout(() => setStoryOpen(false), OVERLAY_FADE_MS)
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
                customStation={customStation}
                customCommutes={customCommutes}
                aiHighlightFeatures={aiHighlightFeatures}
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
              <DestinationPicker />

              <div className="hidden md:block w-px h-6 bg-ed-ink/15" />
              <div className="md:hidden h-px bg-ed-ink/10" />

              <div className="flex items-center gap-3">
                <TimeSlider />
                <div className="w-px h-5 bg-ed-ink/15" />
                <TransferFilter />
              </div>
            </div>

            <Legend />

            {/* AI 推薦エントリ — 常時表示。hasCache=true で「20 駅再表示」、false で「初回 AI に聞く」(#6)
                aiCache が無い user も地図上から後追いで AI Advisor を起動できるようにする死路 UX 対策。 */}
            <AiRecallButton
              hasCache={isAiCacheFresh(aiCache)}
              onClick={isAiCacheFresh(aiCache) ? handleRecallWizard : handleStartWizard}
            />

            <StationDrawer
              destination={destination}
              customStation={customStation}
              customCommutes={customCommutes}
              aiRecallAvailable={
                !!aiCache && !!selectedStation &&
                aiCache.recs.some(r => r.station_name === selectedStation.name)
              }
              onRecallAi={handleRecallAiFromDrawer}
              onSetAsDestination={handleSetAsDestination}
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
          onConfirm={handleConfirmDestination}
          onStartWizard={handleStartWizard}
          onRecallWizard={handleRecallWizard}
          aiCacheFresh={isAiCacheFresh(aiCache)}
        />
      )}

      {wizardOpen && (
        <AiWizard
          cachedResult={
            wizardOpen === 'recall' && aiCache
              ? {
                  recs: aiCache.recs,
                  destination: aiCache.destination === 'custom' && aiCache.customStation
                    ? { kind: 'custom', station: aiCache.customStation }
                    : { kind: 'fixed', slug: aiCache.destination as FixedDestinationType },
                }
              : undefined
          }
          onClose={handleWizardClose}
          onResolve={handleWizardResolve}
          onResultReady={handleAiResultReady}
        />
      )}

      {/* 加載画面 — MapView の onReady 発火後 ~1.7s で fade out + unmount */}
      {loaderMounted && <LoadingOverlay visible={loaderVisible} />}
    </>
  )
}
