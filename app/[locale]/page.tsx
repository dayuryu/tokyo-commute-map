'use client'
import { useState, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
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
import type { Recommendation } from '@/lib/ai-recommend/types'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { OVERLAY_FADE_MS } from '@/lib/constants'
import { selectedStationAtom } from '@/lib/atoms/ui'
import { stationByNameAtom } from '@/lib/atoms/data'
import { setDestinationAtom } from '@/lib/atoms/domain'
import {
  aiCacheAtom,
  aiCacheFreshAtom,
  type AiCache,
} from '@/lib/atoms/ai-cache'
import { useDataLoaders } from '@/hooks/useDataLoaders'
import { useBootstrapDestination, useBootstrapAiCache } from '@/hooks/useBootstrap'
import type {
  CustomStation,
  Destination,
  Station,
  WizardDestination,
} from '@/lib/types'

/** Wizard の起動モード — false=閉、'new'=新規 6 問、'recall'=キャッシュから result phase 直起動 */
type WizardOpenMode = false | 'new' | 'recall'

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
  // 初回 mount で localStorage から destination / aiCache を復元（atom 経路）。
  useBootstrapDestination()
  useBootstrapAiCache()

  // データ加載層は lib/atoms/data.ts + hooks/useDataLoaders に移行。消費 component
  // （StationDrawer / DestinationPicker / AiWizard / DestinationAsk / MapView）は
  // 各 atom を直接購読する。page 側で読むのは handleWizardResolve の駅名 lookup のみ。
  useDataLoaders(locale)
  const stationByName = useAtomValue(stationByNameAtom)

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

  // localStorage 読み取り（初回のみ） — destination 復元は useBootstrapDestination、
  // aiCache 復元は atomWithStorage が hydrate するため、ここでは visited 判定と
  // forceWelcome の処理のみ。
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
    // 一度訪問済みのユーザーはマップを直接マウント（destination 復元は useBootstrapDestination、
    // aiCache 復元は aiCacheAtom の atomWithStorage が担当）。
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
    if (aiCacheFresh) {
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
  // aiCacheAtom の atomWithStorage が localStorage 永続化を担当するため、set 一回で完結。
  function handleAiResultReady(dest: WizardDestination, recs: Recommendation[]) {
    const next: AiCache = dest.kind === 'fixed'
      ? { destination: dest.slug, recs, usedAt: new Date().toISOString() }
      : { destination: 'custom', customStation: dest.station, recs, usedAt: new Date().toISOString() }
    setAiCache(next)
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
          aiCacheFresh={aiCacheFresh}
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
      {loaderMounted && <LoadingOverlay visible={loaderVisible} />}
    </>
  )
}
