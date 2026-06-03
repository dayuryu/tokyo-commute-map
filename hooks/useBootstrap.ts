'use client'

/**
 * 初回マウント時に localStorage から destination を復元する hook（ADR-0003 P3）。
 *
 * 旧 page.tsx の mount effect 内に書かれていた destination 復元ロジックを切り出した。
 * `parseStoredDestination` で読み取り → `setDestinationAtom` の `{persist:false}` 経路で
 * 反映する（読んだ値を即書き戻す無駄を回避 + 復元 vs 通常書き込みを意図的に分離）。
 *
 * 既存ユーザーの永続化された state を尊重するため、SSR mismatch を避けて
 * `useEffect` 内で 1 回だけ実行する。無効データ / 未保存は no-op。
 */
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { setDestinationAtom } from '@/lib/atoms/domain'
import { parseStoredDestination } from '@/lib/atoms/destination-storage'
import { aiCacheAtom, readStoredAiCache } from '@/lib/atoms/ai-cache'
import { STORAGE_KEYS } from '@/lib/storage-keys'

export function useBootstrapDestination() {
  const setDestination = useSetAtom(setDestinationAtom)

  useEffect(() => {
    let raw: string | null = null
    try { raw = localStorage.getItem(STORAGE_KEYS.destination) } catch {}
    const restored = parseStoredDestination(raw)
    if (restored) {
      setDestination(restored, { persist: false })
    }
    // 初回 mount で 1 回だけ実行する。setter は安定 reference なので依存配列 [] で問題ない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * 初回マウント時に localStorage から AI 推薦 cache を復元する hook（ADR-0003 P4）。
 *
 * `aiCacheAtom` の write 関数を経由すると set 時に localStorage への書戻しが発生してしまう
 * （hydrate 後に同じ値を書き戻すことになり挙動上は無害だが意図と合わない）。本 hook の
 * write 経路はあえて publicly な aiCacheAtom を使う — 「読んだ値を即書き戻す」副作用は
 * 一度きりで害がなく、書き込み口を一本化する設計の方が将来の読みやすさで勝るため。
 */
export function useBootstrapAiCache() {
  const setAiCache = useSetAtom(aiCacheAtom)
  useEffect(() => {
    const stored = readStoredAiCache()
    if (stored) setAiCache(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
