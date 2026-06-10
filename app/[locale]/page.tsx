'use client'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useLocale } from 'next-intl'
import TimeSlider from '@/components/TimeSlider'
import DestinationPicker from '@/components/DestinationPicker'
import StationDrawer from '@/components/StationDrawer'
import TransferFilter from '@/components/TransferFilter'
import WelcomeOverlay from '@/components/WelcomeOverlay'
import LoadingOverlay from '@/components/LoadingOverlay'
import Story from '@/components/Story'
import Legend from '@/components/Legend'
import HeaderMenu from '@/components/HeaderMenu'
import FavoritesPanel from '@/components/FavoritesPanel'
import CookieConsent from '@/components/CookieConsent'
import DestinationAsk from '@/components/DestinationAsk'
import AiWizard from '@/components/AiWizard'
import AiRecallButton from '@/components/AiRecallButton'
import type { Recommendation } from '@/lib/ai-recommend/types'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { trackEvent } from '@/lib/analytics'
import { selectedStationAtom } from '@/lib/atoms/ui'
import { stationByNameAtom } from '@/lib/atoms/data'
import { bootstrapRyugakuHighlightAtom } from '@/lib/atoms/ryugaku'
import RyugakuStationsChip from '@/components/RyugakuStationsChip'
import { setDestinationAtom } from '@/lib/atoms/domain'
import {
  aiCacheAtom,
  aiCacheFreshAtom,
  type AiCache,
} from '@/lib/atoms/ai-cache'
import {
  overlayAtom,
  bootstrapOverlayAtom,
  enterOnboardingAskAtom,
  enterStoryAtom,
  backToWelcomeAtom,
  openHelpAtom,
  confirmDestinationOverlayAtom,
  startWizardOverlayAtom,
  recallWizardOverlayAtom,
  closeWizardOverlayAtom,
  resolveWizardOverlayAtom,
  onMapReadyOverlayAtom,
} from '@/lib/atoms/overlay'
import { useDataLoaders } from '@/hooks/useDataLoaders'
import {
  useBootstrapDestination,
  useBootstrapAiCache,
  useBootstrapFavorites,
} from '@/hooks/useBootstrap'

// MapLibre (~350KB transfer) を初回 JS バンドルから分離する。地図は Welcome /
// LoadingOverlay の背後で初期化されるため、chunk の遅延到着はユーザーに見えない
// (ローディング表示は既存の onReady 連動 LoadingOverlay がそのまま担う)。
// canvas 前提の client-only コンポーネントなので ssr: false が自然。
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })
import type {
  CustomStation,
  Destination,
  Station,
  WizardDestination,
} from '@/lib/types'

export default function Home() {
  const locale = useLocale()
  // destination / customStation / customCommutes / aiHighlightFeatures は全て atom 層へ
  // 移行済（ADR-0003 P3/P4）。消費 component が各 atom を直接購読するため、page では
  // 「handler 内で書き込む / Wizard cachedResult 構築で読む」用途に限って setter / 値を
  // 取得する。
  const setDestination = useSetAtom(setDestinationAtom)
  // selectedStation は handler で null クリアするためここで setter を取る。
  const setSelectedStation = useSetAtom(selectedStationAtom)
  // AI 推薦 cache 本体（読み・書き双方ある）。localStorage 永続化は atomWithStorage が
  // 裏で処理するため、handleAiResultReady の手動 localStorage.setItem は不要。
  const [aiCache, setAiCache] = useAtom(aiCacheAtom)
  const aiCacheFresh = useAtomValue(aiCacheFreshAtom)
  // 初回 mount で localStorage から destination / aiCache / お気に入りを復元（atom 経路）。
  useBootstrapDestination()
  useBootstrapAiCache()
  useBootstrapFavorites()

  // データ加載層は lib/atoms/data.ts + hooks/useDataLoaders に移行。消費 component
  // （StationDrawer / DestinationPicker / AiWizard / DestinationAsk / MapView）は
  // 各 atom を直接購読する。page 側で読むのは handleWizardResolve の駅名 lookup のみ。
  useDataLoaders(locale)
  const stationByName = useAtomValue(stationByNameAtom)

  // Overlay 状態（9 flag）は lib/atoms/overlay.ts に統合済（ADR-0003 P5）。
  // page では読み取りと意味づけ write atom の起動のみ。setTimeout 瀑布は atom 層内部。
  const overlay = useAtomValue(overlayAtom)
  const bootstrapOverlay = useSetAtom(bootstrapOverlayAtom)
  const enterOnboardingAsk = useSetAtom(enterOnboardingAskAtom)
  const enterStory = useSetAtom(enterStoryAtom)
  const backToWelcome = useSetAtom(backToWelcomeAtom)
  const openHelp = useSetAtom(openHelpAtom)
  const confirmDestinationOverlay = useSetAtom(confirmDestinationOverlayAtom)
  const startWizardOverlay = useSetAtom(startWizardOverlayAtom)
  const recallWizardOverlay = useSetAtom(recallWizardOverlayAtom)
  const closeWizardOverlay = useSetAtom(closeWizardOverlayAtom)
  const resolveWizardOverlay = useSetAtom(resolveWizardOverlayAtom)
  const onMapReadyOverlay = useSetAtom(onMapReadyOverlayAtom)

  // mount effect — visited / forceWelcome 判定だけ残る。
  // destination 復元は useBootstrapDestination、aiCache 復元は useBootstrapAiCache、
  // overlay 初期状態は bootstrapOverlay が担当。
  const bootstrapRyugakuHighlight = useSetAtom(bootstrapRyugakuHighlightAtom)

  useEffect(() => {
    let visited = false
    try { visited = localStorage.getItem(STORAGE_KEYS.visited) === '1' } catch {}
    let forceWelcome = false
    try {
      if (sessionStorage.getItem(STORAGE_KEYS.welcomeAfterLocaleSwitch) === '1') {
        forceWelcome = true
        sessionStorage.removeItem(STORAGE_KEYS.welcomeAfterLocaleSwitch)
      }
    } catch {}
    // /ryugaku 測試からの導流 (?rstations=)。解析・検証は atom 層に封装。
    // 流入時は初訪 user でも onboarding を飛ばして地図へ直行する
    // （「自分の本命駅を見る」が来訪目的なので Welcome に埋めない。
    //   visited は永続化しない — 次回オーガニック訪問では通常の Welcome を見せる）。
    const hasRyugaku = bootstrapRyugakuHighlight(window.location.search)
    bootstrapOverlay({
      visited: visited || hasRyugaku,
      forceWelcome: hasRyugaku ? false : forceWelcome,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persistVisited() {
    try { localStorage.setItem(STORAGE_KEYS.visited, '1') } catch {}
  }

  // ── Welcome / Story / DestinationAsk 遷移 ──────────────────
  function handleEnterMap() {
    persistVisited()
    enterOnboardingAsk()
  }

  function handleEnterStory() {
    persistVisited()
    enterStory()
  }

  function handleStoryBack() { backToWelcome() }
  function handleHelpClick()  { openHelp() }

  // ── StationDrawer から ──
  function handleSetAsDestination(station: Station) {
    const custom: CustomStation = {
      code: station.code,
      name: station.name,
      nameEn: station.name_en,
      lat:  station.lat,
      lon:  station.lon,
    }
    setDestination({ kind: 'custom', station: custom })
    setSelectedStation(null)
  }

  // ── DestinationAsk 確定 ──
  function handleConfirmDestination(dest: Destination, custom: CustomStation | null) {
    if (dest === 'custom' && custom) {
      setDestination({ kind: 'custom', station: custom })
    } else if (dest !== 'custom') {
      setDestination({ kind: 'fixed', slug: dest })
    }
    confirmDestinationOverlay()
  }

  // ── AI Wizard 関連 handler ──
  function handleStartWizard() {
    if (aiCacheFresh) return  // 防御 — DestinationAsk が通常 disable
    persistVisited()
    setSelectedStation(null)
    startWizardOverlay()
  }

  function handleRecallWizard() {
    if (!aiCache) return
    persistVisited()
    setSelectedStation(null)
    recallWizardOverlay()
  }

  function handleRecallAiFromDrawer() {
    if (!aiCache) return
    trackEvent('ai_entry_click', { entry: 'drawer_link', mode: 'recall' })
    setSelectedStation(null)
    handleRecallWizard()
  }

  // aiCacheAtom の write fn が localStorage 永続化を担当するため、set 一回で完結。
  function handleAiResultReady(dest: WizardDestination, recs: Recommendation[]) {
    const next: AiCache = dest.kind === 'fixed'
      ? { destination: dest.slug, recs, usedAt: new Date().toISOString() }
      : { destination: 'custom', customStation: dest.station, recs, usedAt: new Date().toISOString() }
    setAiCache(next)
  }

  function handleWizardClose(dest: WizardDestination | null) {
    if (dest) setDestination(dest)
    closeWizardOverlay()
  }

  // 結果カードクリック — backend openai.ts で validNames 厳格 filter 済みのため
  // 通常 lookup miss しないが、防御的に miss 時は close 経路に縮退（silent failure 回避）。
  function handleWizardResolve(dest: WizardDestination, stationName: string) {
    const found = stationByName[stationName] ?? null
    if (!found) {
      console.warn(`[Wizard] stationByName miss for "${stationName}", falling back to close`)
      handleWizardClose(dest)
      return
    }
    setDestination(dest)
    setSelectedStation(found)
    resolveWizardOverlay()
  }

  function handleMapReady() { onMapReadyOverlay() }

  return (
    <>
      <main className="relative w-full h-full bg-sp-bg">
        {/* マップは一度 mount したら以降ずっと表示。Welcome/Story 中はオーバーレイで覆う。 */}
        {overlay.mapMounted && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: overlay.mapReady ? 1 : 0,
                transform: overlay.mapReady ? 'scale(1)' : 'scale(1.015)',
                transformOrigin: 'center center',
                transition:
                  'opacity 1.2s cubic-bezier(.2,.8,.2,1), transform 1.6s cubic-bezier(.2,.8,.2,1)',
                willChange: 'opacity, transform',
              }}
            >
              <MapView onReady={handleMapReady} />
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

            {/* AI 推薦エントリ — 常時表示。fresh cache の有無で「20 駅再表示」/「初回 AI に聞く」を切替 (#6)
                aiCache が無い user も地図上から後追いで AI Advisor を起動できるようにする死路 UX 対策。
                cache fresh 判定 + onClick 分流は AiRecallButton 内で aiCacheFreshAtom を自取して行う。 */}
            <AiRecallButton
              onStartWizard={handleStartWizard}
              onRecallWizard={handleRecallWizard}
            />

            <StationDrawer
              onRecallAi={handleRecallAiFromDrawer}
              onSetAsDestination={handleSetAsDestination}
            />

            <HeaderMenu onHelp={handleHelpClick} />
            <FavoritesPanel />
            <RyugakuStationsChip />
            <CookieConsent />
          </>
        )}
      </main>

      {/* curtain — Welcome ↔ Story 過渡中、地図が隙間から透けないよう
          常に不透明な cream の地板を z=80 に敷く。両 overlay が同時に
          open している瞬間だけ存在。 */}
      {overlay.welcomeOpen === true && overlay.storyOpen && (
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
      {overlay.destinationAskFadeIn && (
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

      {overlay.welcomeOpen === true && (
        <WelcomeOverlay
          onEnterMap={handleEnterMap}
          onEnterStory={handleEnterStory}
        />
      )}

      {overlay.storyOpen && (
        <Story
          onEnterMap={handleEnterMap}
          onBack={handleStoryBack}
        />
      )}

      {overlay.destinationAskOpen && (
        <DestinationAsk
          onConfirm={handleConfirmDestination}
          onStartWizard={handleStartWizard}
          onRecallWizard={handleRecallWizard}
          aiCacheFresh={aiCacheFresh}
        />
      )}

      {overlay.wizardOpen && (
        <AiWizard
          cachedResult={
            overlay.wizardOpen === 'recall' && aiCache
              ? {
                  recs: aiCache.recs,
                  destination: aiCache.destination === 'custom' && aiCache.customStation
                    ? { kind: 'custom', station: aiCache.customStation }
                    : { kind: 'fixed', slug: aiCache.destination },
                }
              : undefined
          }
          onClose={handleWizardClose}
          onResolve={handleWizardResolve}
          onResultReady={handleAiResultReady}
        />
      )}

      {/* 加載画面 — MapView の onReady 発火後 ~1.7s で fade out + unmount */}
      {overlay.loaderMounted && <LoadingOverlay visible={overlay.loaderVisible} />}
    </>
  )
}
