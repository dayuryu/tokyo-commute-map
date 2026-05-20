/**
 * プロジェクト横断で使う数値・文字列定数の SSOT。
 *
 * **収納方針**:
 * - 複数ファイルで同じ意味で使われる数値・文字列をここに集約
 * - 単一ファイル内部の magic number はそのファイル内 const のままで OK（過剰集約防止）
 * - 業務 enum / 表示名 / locale 別文字列は対応する専用層へ（destinations.ts / messages/*.json 等）
 *
 * **命名**: `SCREAMING_SNAKE_CASE`、単位は名前末尾に（`_MS`, `_SECONDS`, `_DAYS`, `_PX` 等）。
 */

// ──────────────────────────────────────────────────────────────
// 時間
// ──────────────────────────────────────────────────────────────

/** 1 日のミリ秒。AI cache freshness / rate limit cutoff 等で多用。 */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** Welcome / Story / Wizard / DestinationAsk の fade out 待ち時間。
 *  子コンポーネントの transition: opacity .9s と同期。
 *  変更時は globals.css の対応する transition 値も併せて修正。 */
export const OVERLAY_FADE_MS = 900
