/**
 * Device ID — localStorage に永続化される匿名 UUID。
 * Supabase 上の rate limit (1/day per device) と評価重複判定の key として使う。
 *
 * `crypto.randomUUID` は Secure Context (HTTPS / localhost) でしか定義されない。
 * dev server を LAN の IP (http://192.168.1.7:3000 等) で開いた場合は undefined
 * になり、未対応だと TypeError でアプリが死ぬ。fallback を 3 段で組む:
 *   1. crypto.randomUUID()                — Secure Context (本番 HTTPS / localhost)
 *   2. crypto.getRandomValues + 手動組立  — 非 Secure Context でも可、暗号学強度あり
 *   3. Math.random() の組立              — どこでも動く最終手段（id 用途で十分）
 */

function genUuid(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      // RFC 4122 v4 のバージョン / バリアントビット
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const DEVICE_KEY = 'tcm_device_id'

/**
 * localStorage 永続化された device ID を取得。未生成なら新規発行 + 保存。
 * Private browsing 等で localStorage 不可な場合は揮発 UUID を返す
 * (rate limit は IP hash で代用される)。
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY) ?? ''
    if (!id) {
      id = genUuid()
      try { localStorage.setItem(DEVICE_KEY, id) } catch {}
    }
    return id
  } catch {
    return genUuid()
  }
}
