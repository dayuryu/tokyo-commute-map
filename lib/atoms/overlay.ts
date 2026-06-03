/**
 * Overlay 状態機 atom 層（ADR-0003 P5、最高風險阶段）。
 *
 * 旧 page.tsx は 9 個の overlay flag を個別 useState で持ち、handler 内で
 * `window.setTimeout(...)` を直書きしていた。setTimeout 瀑布鎖は UX 体験の
 * ミリ秒級調整の結晶（fade in/out の重なり、curtain の z-order、loader fade）で、
 * これらが page.tsx に散在することで時序バグの温床になっていた。
 *
 * **本層の方針**:
 * - 9 flag を単一 `_overlayBaseAtom`（**module 私有**）に統合。外部からは
 *   `overlayAtom` 読み取り視図 + 意味づけ write atom 群のみ公開。
 * - 各 write atom 内の setTimeout 瀑布は旧 page.tsx と **1:1 で原様移植**
 *   （時長 OVERLAY_FADE_MS / 800ms / 1200ms / 600ms / 500ms、順序、条件分岐すべて維持）。
 * - destination / selectedStation / aiCache の更新は本層の責務外（page handler に残る）。
 *
 * **何故 setTimeout を atom 層に移すか**: page handler はビジネス意図
 * （「Welcome → Map に遷移」）を表現し、UX 時序の詳細（「fade out を OVERLAY_FADE_MS 待つ」）
 * は atom 層に閉じ込めることで、handler 1 行に塌缩できる。
 */
import { atom, type WritableAtom } from 'jotai'
import { OVERLAY_FADE_MS } from '@/lib/constants'

/** Wizard の起動モード — false=閉、'new'=新規 6 問、'recall'=キャッシュから result phase 直起動 */
export type WizardOpenMode = false | 'new' | 'recall'

export interface OverlayState {
  /** Welcome 浮層。null = 初回 SSR 判定中（hydration 安全） */
  welcomeOpen:          boolean | null
  storyOpen:            boolean
  destinationAskOpen:   boolean
  /** DestinationAsk が fade in 中（curtain z=82 を出す期間） */
  destinationAskFadeIn: boolean
  wizardOpen:           WizardOpenMode
  /** 一度 true になったら false に戻さない（防闪屏） */
  mapMounted:           boolean
  /** DOM 上の mount/unmount。fade out 完了後に外す */
  loaderMounted:        boolean
  /** loader の opacity 制御 — fade in/out を 1 つの CSS トランジションで */
  loaderVisible:        boolean
  /** MapView が初回 idle を発火した（タイル＋レイヤ描画完了）。一度 true になったら戻さない */
  mapReady:             boolean
}

const _overlayBaseAtom = atom<OverlayState>({
  welcomeOpen:          null,
  storyOpen:            false,
  destinationAskOpen:   false,
  destinationAskFadeIn: false,
  wizardOpen:           false,
  mapMounted:           false,
  loaderMounted:        false,
  loaderVisible:        false,
  mapReady:             false,
})

/** Overlay 状態全体（読み取り専用）。消費 component は本 atom を自取して各 flag を解構する。 */
export const overlayAtom = atom((get) => get(_overlayBaseAtom))

// ── 内部ヘルパー ──────────────────────────────────────────────────────────
// jotai write fn の set には base atom + partial を渡し、
// previous state を spread した上で部分更新する 1 パターンしかないため、
// 短縮 helper を closure 化して各 write atom の本体を読みやすく保つ。
type Setter = Parameters<NonNullable<WritableAtom<unknown, [], void>['write']>>[1]
function patchOverlay(set: Setter, p: Partial<OverlayState>): void {
  set(_overlayBaseAtom, (s) => ({ ...s, ...p }))
}

// ── 初回 bootstrap ────────────────────────────────────────────────────────

/**
 * page.tsx の mount effect に書かれていた「visited / forceWelcome 判定 → 初期 overlay 状態決定」を吸収。
 * `setWelcomeOpen(!visited || forceWelcome)` + 訪問済み user は mapMounted/loader を立てて map に直接入場、を 1 アクションで。
 */
export const bootstrapOverlayAtom = atom(
  null,
  (_get, set, opts: { visited: boolean; forceWelcome: boolean }) => {
    const showWelcome = !opts.visited || opts.forceWelcome
    const skipOnboarding = opts.visited && !opts.forceWelcome
    patchOverlay(set, {
      welcomeOpen: showWelcome,
      // 訪問済み user はマップ直接マウント + loader（白画面回避）
      ...(skipOnboarding && {
        mapMounted:    true,
        loaderMounted: true,
        loaderVisible: true,
      }),
    })
  },
)

// ── Welcome / Story / DestinationAsk 遷移 ──────────────────────────────────

/**
 * Welcome / Story の「地図へ」CTA — DestinationAsk を経由してから Map へ。
 * mapMounted はここでは true にせず、DestinationAsk で確定したタイミングで上げる。
 * Welcome の fade out (~900ms) と DestinationAsk の fade in を重ねるため、
 * OVERLAY_FADE_MS 後に Welcome/Story を外す + curtain を片付ける。
 */
export const enterOnboardingAskAtom = atom(null, (_get, set) => {
  patchOverlay(set, {
    destinationAskOpen:   true,
    destinationAskFadeIn: true,  // curtain z=82 を出す
  })
  window.setTimeout(() => {
    patchOverlay(set, {
      storyOpen:            false,
      welcomeOpen:          false,
      destinationAskFadeIn: false,  // fade in 完了 → curtain を外す
    })
  }, OVERLAY_FADE_MS)
})

/** Welcome の Ghost CTA — Story を開く（マップはまだマウントしない）。 */
export const enterStoryAtom = atom(null, (_get, set) => {
  patchOverlay(set, { storyOpen: true })
  window.setTimeout(() => {
    patchOverlay(set, { welcomeOpen: false })
  }, OVERLAY_FADE_MS)
})

/**
 * Story → Welcome 戻り。Welcome を先に mount し、Story は OVERLAY_FADE_MS 後に外す。
 * 両方が同時に open している間は curtain (z=80) で地図を隠す（JSX 側で判定）。
 */
export const backToWelcomeAtom = atom(null, (_get, set) => {
  patchOverlay(set, { welcomeOpen: true })
  window.setTimeout(() => {
    patchOverlay(set, { storyOpen: false })
  }, OVERLAY_FADE_MS)
})

/** Help ボタン — Welcome を再表示（mapMounted は維持）。 */
export const openHelpAtom = atom(null, (_get, set) => {
  patchOverlay(set, { welcomeOpen: true })
})

// ── DestinationAsk → Map 確定 ────────────────────────────────────────────

/**
 * DestinationAsk から通勤先確定が返ってきた時の overlay 部分。
 * destination 更新は呼出側で別途 setDestinationAtom（責務分離）。
 *
 * 既に地図が ready 済みの場合（再訪問・主页 → DestinationAsk → 再入場）は
 * MapView が remount しないので map.once('idle', ...) が再発火しない。
 * 手動で loader fade out を schedule して卡死を防ぐ。
 * 初回訪問時は mapReady=false で MapView.onReady → onMapReadyAtom で自動 fade される。
 */
export const confirmDestinationOverlayAtom = atom(null, (get, set) => {
  const s = get(_overlayBaseAtom)
  patchOverlay(set, {
    mapMounted:    true,
    loaderMounted: true,
    loaderVisible: true,
  })
  if (s.mapReady) {
    window.setTimeout(() => patchOverlay(set, { loaderVisible: false }), 800)
    window.setTimeout(() => patchOverlay(set, { loaderMounted: false }), 800 + 1200)
  }
  // DestinationAsk 自身の fade out アニメ完了後に unmount
  window.setTimeout(() => patchOverlay(set, { destinationAskOpen: false }), OVERLAY_FADE_MS)
})

// ── AI Wizard 起動 / 終了 ─────────────────────────────────────────────────

/**
 * 新規 Wizard 起動（DestinationAsk の AI hero CTA から）。selectedStation 解除は呼出側。
 * destinationAskOpen の閉じ込み fade out も含めて瀑布鎖 1:1 で移植。
 */
export const startWizardOverlayAtom = atom(null, (_get, set) => {
  patchOverlay(set, { wizardOpen: 'new' })
  window.setTimeout(() => patchOverlay(set, { destinationAskOpen: false }), OVERLAY_FADE_MS)
})

/**
 * Wizard recall 起動（DestinationAsk recall CTA / AiRecallButton / StationDrawer link から）。
 * destinationAskOpen が開いている場合のみ閉じる遷移を入れる（地図経由 recall 時は不要）。
 */
export const recallWizardOverlayAtom = atom(null, (get, set) => {
  const s = get(_overlayBaseAtom)
  patchOverlay(set, { wizardOpen: 'recall' })
  if (s.destinationAskOpen) {
    window.setTimeout(() => patchOverlay(set, { destinationAskOpen: false }), OVERLAY_FADE_MS)
  }
})

/**
 * Wizard を閉じる（取消、または結果 CTA「地図で見比べる」押下）。
 * 地図を mount + loader fade で表示し Wizard を fade out で外す。
 * 「既に Map / loader が ready の場合、loader は出ているなら fade out、出ていなければそのまま地図表示」
 * の条件分岐をそのまま保持。
 */
export const closeWizardOverlayAtom = atom(null, (get, set) => {
  const s = get(_overlayBaseAtom)
  if (!s.mapMounted) {
    patchOverlay(set, {
      mapMounted:    true,
      loaderMounted: true,
      loaderVisible: true,
    })
  }
  if (s.mapReady && s.loaderVisible) {
    window.setTimeout(() => patchOverlay(set, { loaderVisible: false }), 600)
    window.setTimeout(() => patchOverlay(set, { loaderMounted: false }), 600 + 1200)
  }
  window.setTimeout(() => patchOverlay(set, { wizardOpen: false }), OVERLAY_FADE_MS)
})

/**
 * Wizard 結果カードクリック — 該当駅 drawer 即時 open + Wizard 即時 unmount。
 * AiWizard.handleResolve 側で既に 700ms closing fade を消費しているため、
 * ここでは即時クローズ（OVERLAY_FADE_MS 待たない）。loader は走らせない。
 * 駅 drawer 開閉は呼出側で setSelectedStation。
 */
export const resolveWizardOverlayAtom = atom(null, (get, set) => {
  const s = get(_overlayBaseAtom)
  if (!s.mapMounted) {
    patchOverlay(set, {
      mapMounted:    true,
      loaderMounted: true,
      loaderVisible: true,
    })
  }
  patchOverlay(set, { wizardOpen: false })
})

// ── MapView 通知 ─────────────────────────────────────────────────────────

/**
 * MapView から ready 通知。加載画面を 500ms グレースしてから fade out、
 * 1.7s で opacity 0 になったら DOM を unmount。
 * 一度 mapReady=true になったら戻さない（防闪屏）。
 */
export const onMapReadyOverlayAtom = atom(null, (get, set) => {
  const s = get(_overlayBaseAtom)
  if (s.mapReady) return
  patchOverlay(set, { mapReady: true })
  window.setTimeout(() => patchOverlay(set, { loaderVisible: false }), 500)
  window.setTimeout(() => patchOverlay(set, { loaderMounted: false }), 500 + 1200)
})
