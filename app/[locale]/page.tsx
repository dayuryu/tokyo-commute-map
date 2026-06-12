'use client'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import NextLink from 'next/link'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useLocale, useTranslations } from 'next-intl'
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
  const tHeader = useTranslations('header')
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

        {/* SEO: welcomeOpen=null は SSR / hydration 前のみ。この間、素の HTML に
            実コンテンツ（h1 + 使い方 + 機能 + 内部リンク）を出す（第一波クロール用）。
            競合調査 2026-06: 「通勤時間 マップ」SERP は静的テキストを持つ側が勝つ。
            hydration 後は WelcomeOverlay（同趣旨の文言 + 可視リンク）/ HeaderMenu が引き継ぐ。
            ja のみ — 目標クエリが日本語のため（station-pages-design.md と同方針）。 */}
        {overlay.welcomeOpen === null && (locale === 'ja' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'auto',
              background: 'var(--paper, #f3ecdd)',
              color: 'var(--ink, #2b2620)',
              fontFamily: 'var(--font-shippori), "Shippori Mincho", serif',
              padding: '48px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)',
            }}
          >
            <div style={{ maxWidth: 640, margin: '0 auto', lineHeight: 1.9 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px' }}>
                Kayoha 通勤時間マップ — 東京圏1831駅から住む街を探す
              </h1>
              <p style={{ margin: '0 0 20px', fontSize: 14 }}>
                通勤先を選ぶだけで、東京圏の全1831駅が通勤時間で色分けされます。実際の時刻表データで算出した所要時間に、駅ごとの家賃相場・街の特徴・コミュニティ評価を重ねて、「どこに住むか」をひと目で比較できる無料の通勤時間マップです。登録は不要です。
              </p>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>使い方</h2>
              <ol style={{ margin: '0 0 20px', paddingLeft: 22, fontSize: 14 }}>
                <li>通勤先（職場・学校など）の駅を選ぶ</li>
                <li>地図上の全駅が通勤時間で色分けされる — スライダーで「何分圏内」を絞り込み</li>
                <li>気になる駅をタップして家賃相場・街の特徴・住民の評価を確認</li>
              </ol>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>主な機能</h2>
              <ul style={{ margin: '0 0 20px', paddingLeft: 22, fontSize: 14 }}>
                <li>通勤・通学圏の確認 — 乗換回数フィルタつきで、実時刻表ベースの通勤圏がわかります</li>
                <li>二拠点通勤 — 2つの通勤先（共働き・ダブルワーク）の両方に通いやすいエリアを合成表示</li>
                <li>AI 住む街推薦 — 希望条件を伝えると、候補駅を理由つきで提案</li>
                <li>駅・エリアガイド — <NextLink href="/to" style={{ color: 'inherit' }}>通勤先別ガイド</NextLink>と<NextLink href="/area" style={{ color: 'inherit' }}>区市別の駅データ一覧</NextLink>で、家賃と通勤時間をデータで比較</li>
              </ul>
              <nav style={{ fontSize: 13, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <NextLink href="/to" style={{ color: 'inherit' }}>{tHeader('guide')}</NextLink>
                <NextLink href="/area" style={{ color: 'inherit' }}>{tHeader('area')}</NextLink>
                <NextLink href="/legal" style={{ color: 'inherit' }}>{tHeader('legal')}</NextLink>
              </nav>
            </div>
          </div>
        ) : (
          <nav
            style={{
              position: 'absolute',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
              fontSize: 11,
              color: 'var(--ink-mute)',
            }}
          >
            <NextLink href={`/${locale}/to`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {tHeader('guide')}
            </NextLink>
            {locale === 'zh' && (
              <NextLink href="/zh/ryugaku" style={{ color: 'inherit', textDecoration: 'none' }}>
                {tHeader('ryugaku')}
              </NextLink>
            )}
            <NextLink href={`/${locale}/legal`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {tHeader('legal')}
            </NextLink>
          </nav>
        ))}
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
