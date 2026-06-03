/**
 * destination の localStorage 永続化 schema と、メモリ表現 ⟺ 保存形式 を相互変換する
 * 純関数。ADR-0003 P3 で導入。
 *
 * 保存 schema（STORAGE_KEYS.destination = 'tcm.destination.v1'）は歴史的に
 * `{ type: 'custom'; station } | { type: 'default'; dest }` の判別聯合。
 * メモリ側の WizardDestination（`{ kind: 'fixed' } | { kind: 'custom' }`）とは
 * 形が異なるため、両者を結ぶ一対一の相互変換をこの 1 ファイルに閉じ込める。
 * serialize / parse が互いに逆関数になっていることが不変量維持の前提。
 */
import type { Destination, CustomStation, WizardDestination } from '@/lib/types'
import { isFixedDestination } from '@/lib/destinations'

/** localStorage に書き込む際の JSON schema（旧 page.tsx の手書き形状と byte 互換）。 */
type StoredDestination =
  | { type: 'custom';  station: CustomStation }
  | { type: 'default'; dest: Exclude<Destination, 'custom'> }

/**
 * 現在の通勤先 (destination + customStation) を保存用 JSON 文字列に直す。
 * 不変量が割れている場合（destination==='custom' なのに customStation 無し）は
 * null を返し、呼出側は書き込みをスキップする。
 */
export function serializeDestination(
  destination: Destination,
  customStation: CustomStation | null,
): string | null {
  if (destination === 'custom') {
    if (!customStation) return null
    const stored: StoredDestination = { type: 'custom', station: customStation }
    return JSON.stringify(stored)
  }
  const stored: StoredDestination = { type: 'default', dest: destination }
  return JSON.stringify(stored)
}

/**
 * localStorage の生文字列を WizardDestination 意図に復元する。
 * 未保存 (null) / JSON parse 失敗 / schema 不一致 / 未知 slug は全て null を返す
 * （壊れた値の silent ignore。旧 mount effect の防御ロジックと等価）。
 * custom は station.code が number であることまで検証する。
 */
export function parseStoredDestination(raw: string | null): WizardDestination | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredDestination
    if (parsed.type === 'custom' && parsed.station && typeof parsed.station.code === 'number') {
      return { kind: 'custom', station: parsed.station }
    }
    if (parsed.type === 'default' && isFixedDestination(parsed.dest)) {
      return { kind: 'fixed', slug: parsed.dest }
    }
  } catch {
    // 壊れた JSON は無視
  }
  return null
}
