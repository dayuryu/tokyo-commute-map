/**
 * すべての localStorage / sessionStorage キーを 1 箇所に集約する SSOT。
 *
 * **追加時のルール**:
 * - 新キーは必ずここに足す。component 内 hardcoded string は屎山予備軍。
 * - 命名は dot 区切り `tcm.<feature>.v<n>` を推奨。
 * - JSON を保存する時は schema を変えたら `.v2` に上げて旧版を ignore する。
 *
 * **互換性ポリシー**:
 * - 過去に使われたキー値は変更しない。既存ユーザーの永続化された state を破壊しないため。
 * - 命名揺れ（`tcm.xxx` vs `tcm_xxx`）は歴史的経緯で、移行時に統一する優先度は低い。
 */

export const STORAGE_KEYS = {
  /** Welcome オンボーディングを通過したか (localStorage) */
  visited: 'tcm.visited.v1',

  /** 最後に選択した通勤先 (localStorage)。fixed slug or custom station JSON */
  destination: 'tcm.destination.v1',

  /** 2 つ目の通勤先 (localStorage)。schema は destination と同一、未設定時はキー自体なし */
  destination2: 'tcm.destination2.v1',

  /** AI 推薦 24h cache (localStorage)。recall は cache hit で OpenAI 呼ばずに再表示 */
  aiCache: 'tcm.ai_cache.v1',

  /** お気に入り駅 code の配列 (localStorage)。上限 MAX_FAVORITES 駅 */
  favorites: 'tcm.favorites.v1',

  /** Cookie 同意ステータス (localStorage)。'all' | 'necessary' */
  cookieConsent: 'tcm.cookie_consent.v1',

  /** デバイス UUID — 評価 / 通勤校正の重複防止用 (localStorage)。
   *  device-id.ts が初回 crypto.randomUUID で生成、HTTP 環境は fallback あり */
  deviceId: 'tcm_device_id',

  /** AiRecallButton attention pulse を表示済みか (sessionStorage)。
   *  同セッション中の再表示防止用、ブラウザ閉じれば reset */
  aiRecallHinted: 'tcm_ai_recall_hinted_v1',

  /** Welcome 上で言語切替直後、reload 後も Welcome に留まる flag (sessionStorage)。
   *  page.tsx の mount effect が読んで visited を上書きし、即削除する 1-shot flag */
  welcomeAfterLocaleSwitch: 'tcm.welcome_after_switch',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
