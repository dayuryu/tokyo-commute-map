/**
 * Atom 層の barrel — 単一窓口で全 atom を re-export（ADR-0003 P6）。
 *
 * **使い分け**:
 * - 新規 component / 短い import: `import { destinationAtom, overlayAtom } from '@/lib/atoms'`
 * - 既存の分散 import（`@/lib/atoms/domain` 等）も意図的に維持してよい —
 *   import 段で「この component が使う domain」が一目で分かる利点があるため、
 *   無理に切替する必要はない。
 *
 * **本 barrel が import 経路の唯一の選択肢ではない**。`@/lib/atoms/<file>` の
 * 直接 import も同等に有効。
 *
 * **注意**: 本 file は外部 consumer 専用。`lib/atoms/*` 内部の相互 import は
 * 必ず具体 path で行う（barrel を介すと circular dependency になる）。
 */

// ── 叶子 UI atom ──
export {
  maxMinutesAtom,
  maxTransfersAtom,
  selectedStationAtom,
} from './ui'

// ── データ加載層 ──
export {
  stationListAtom,
  stationByNameAtom,
  consensusAtom,
  suumoMapAtom,
  rentMapAtom,
  governmentRentAtom,
  lineStylesAtom,
  lineNamesEnAtom,
  stationEntrancesAtom,
  graphAtom,
} from './data'

export { areaFeaturesAtom } from './area-features'

// ── 核心領域（不変量錠）──
export {
  destinationAtom,
  customStationAtom,
  setDestinationAtom,
} from './domain'

export {
  serializeDestination,
  parseStoredDestination,
} from './destination-storage'

// ── AI 推薦 cache ──
export {
  aiCacheAtom,
  aiCacheFreshAtom,
  aiRecallAvailableAtom,
  readStoredAiCache,
  isAiCacheFresh,
  type AiCache,
} from './ai-cache'

// ── 派生層 ──
export {
  customCommutesAtom,
  aiHighlightFeaturesAtom,
} from './derived'

// ── お気に入り駅 ──
export {
  favoritesAtom,
  toggleFavoriteAtom,
  favoriteStationsAtom,
  favoriteFeaturesAtom,
  favoritesPanelOpenAtom,
  readStoredFavorites,
} from './favorites'

// ── Cookie 同意 ──
export {
  cookieConsentAtom,
  hydrateConsentAtom,
  readStoredConsent,
  type CookieConsentValue,
} from './consent'

// ── Overlay 状態機 ──
export {
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
  type OverlayState,
  type WizardOpenMode,
} from './overlay'
