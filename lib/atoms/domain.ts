/**
 * 核心領域 atom — destination と customStation の不変量を構造で守る層（ADR-0003 P3）。
 *
 * **不変量**:
 *   destination === 'custom'  ⟺  customStation !== null
 *
 * 旧 page.tsx ではこの不変量を 6 個の handler が setDestination + setCustomStation の
 * ペア更新で手動維持していたため、ペア漏れが `1c9a8a1` のような実バグを生んだ。
 *
 * **設計**:
 *   - `commuteTargetAtom` は `{destination, customStation}` のペアを保持し、**module 私有で
 *     export しない**。外部からは直接書けない。
 *   - 外向きには読み取り専用の `destinationAtom` / `customStationAtom`（setter なし）と、
 *     **唯一の書き込み口 `setDestinationAtom`** のみ公開する。
 *   - `setDestinationAtom` は `WizardDestination` 判別聯合を入力に取る。判別聯合自体が
 *     「fixed なら slug のみ / custom なら station のみ」を型で保証するため、半分だけ
 *     書く呼び出し方ができない。型の力で不変量を「表現不可能」にする。
 *   - 永続化（localStorage）もこの write atom の内部で行う。呼出側で書き忘れる経路自体
 *     を消す（`1c9a8a1` の双根因のもう一方を同時に根治）。
 *
 * **オプション**:
 *   `setDestinationAtom` の 2 番目引数で `{ persist: false }` を渡すと localStorage 書き込みを
 *   skip する。`useBootstrap` が localStorage から復元する初回マウント時に使う（読んだ値を
 *   即同じ key へ書き戻す無駄を防ぐ + 復元経路と書き込み経路を意図的に分ける）。
 */
import { atom } from 'jotai'
import type { Destination, CustomStation, WizardDestination } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { serializeDestination } from './destination-storage'

/** 通勤先のペア状態。**module 私有** — export 禁止。
 *  外部からは下記の読み取り専用 atom + setDestinationAtom 経由のみ参照可。 */
const commuteTargetAtom = atom<{
  destination:   Destination
  customStation: CustomStation | null
}>({
  destination:   'shinjuku',  // 旧 page.tsx useState 初期値を踏襲
  customStation: null,
})

/** 2 つ目の通勤先（二拠点通勤）。null = 未設定（単一目的地モード）。
 *  不変量は commuteTargetAtom と同一 — destination === 'custom' ⟺ customStation !== null。
 *  加えて **primary と同一の値は持たない**（下記 sameTarget ガード）。
 *  **module 私有** — 外部からは読み取り専用 atom + setSecondDestinationAtom 経由のみ。 */
const secondTargetAtom = atom<{
  destination:   Destination
  customStation: CustomStation | null
} | null>(null)

/** 通勤先ペア状態と WizardDestination 意図の同一性判定（same-kind のみ）。
 *  fixed は slug、custom は駅 code で照合。fixed ⟷ custom 跨種の物理同一駅は
 *  駅名解決が必要なためここでは扱わない（UI 層が 30 駅名を fixed に正規化する
 *  ため、実用上この層には到達しない）。 */
function sameTarget(
  current: { destination: Destination; customStation: CustomStation | null },
  target: WizardDestination,
): boolean {
  return target.kind === 'fixed'
    ? current.destination === target.slug
    : current.destination === 'custom'
      && current.customStation?.code === target.station.code
}

/** 現在の destination（読み取り専用）。fixed slug or 'custom'。 */
export const destinationAtom = atom((get) => get(commuteTargetAtom).destination)

/** 現在の customStation（読み取り専用）。destination !== 'custom' の時は常に null。 */
export const customStationAtom = atom((get) => get(commuteTargetAtom).customStation)

interface SetDestinationOptions {
  /** false にすると localStorage への書き込みを skip する（既定 true）。
   *  useBootstrap で localStorage から復元する時に使う（読んだ値を書き戻さない）。 */
  persist?: boolean
}

/**
 * 通勤先を更新する**唯一の書き込み口**。WizardDestination から
 * {destination, customStation} ペアと localStorage の両方を一回の操作でアトミックに更新する。
 *
 * 旧 page.tsx の以下 6 個の handler は全てこの 1 関数の呼び出しに塌缩する：
 * handleDestinationChange / handleCustomChange / handleConfirmDestination /
 * handleSetAsDestination / applyWizardDestination / (mount 復元 effect)
 */
export const setDestinationAtom = atom(
  null,
  (
    get,
    set,
    target: WizardDestination,
    options: SetDestinationOptions = {},
  ) => {
    const next = target.kind === 'fixed'
      ? { destination: target.slug as Destination, customStation: null }
      : { destination: 'custom' as Destination, customStation: target.station }

    set(commuteTargetAtom, next)

    // 不変量: primary === second の重複ペアを残さない。
    // タブ / AI 推薦 / 抽屉「目的地に設定」経由で primary が既存の second と
    // 同一になった場合、second は二拠点として無意味になるため自動解除する。
    const second = get(secondTargetAtom)
    if (second && sameTarget(second, target)) {
      set(secondTargetAtom, null)
      try { localStorage.removeItem(STORAGE_KEYS.destination2) } catch {}
    }

    if (options.persist !== false) {
      const json = serializeDestination(next.destination, next.customStation)
      if (json !== null) {
        try { localStorage.setItem(STORAGE_KEYS.destination, json) } catch {}
      }
    }
  },
)

/** 2 つ目の destination（読み取り専用）。未設定時は null。 */
export const secondDestinationAtom = atom((get) => get(secondTargetAtom)?.destination ?? null)

/** 2 つ目の customStation（読み取り専用）。second が custom 以外 / 未設定時は null。 */
export const secondCustomStationAtom = atom((get) => get(secondTargetAtom)?.customStation ?? null)

/**
 * 2 つ目の通勤先を更新する**唯一の書き込み口**。target = null で解除（単一目的地に戻す）。
 * 永続化 schema は destination と共通（destination-storage.ts）、キーのみ別。
 */
export const setSecondDestinationAtom = atom(
  null,
  (
    get,
    set,
    target: WizardDestination | null,
    options: SetDestinationOptions = {},
  ) => {
    // 不変量: primary と同一の second は持たない — 同一値の設定要求は無視する
    // （UI 層にも同等ガードがあるが、bootstrap 復元等の別経路も構造的に塞ぐ）。
    if (target !== null && sameTarget(get(commuteTargetAtom), target)) return

    const next = target === null
      ? null
      : target.kind === 'fixed'
        ? { destination: target.slug as Destination, customStation: null }
        : { destination: 'custom' as Destination, customStation: target.station }

    set(secondTargetAtom, next)

    if (options.persist !== false) {
      try {
        if (next === null) {
          localStorage.removeItem(STORAGE_KEYS.destination2)
        } else {
          const json = serializeDestination(next.destination, next.customStation)
          if (json !== null) localStorage.setItem(STORAGE_KEYS.destination2, json)
        }
      } catch {}
    }
  },
)
