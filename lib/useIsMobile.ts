'use client'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * `< breakpoint` のビューポート幅を判定する。
 *
 * useSyncExternalStore を使う理由：
 * - SSR (サーバサイド) では window が無いため getServerSnapshot で false を返す。
 * - Client hydration の最初のレンダーで getSnapshot が同期的に実行され、
 *   即座に正しい matchMedia の値が取れる。
 *   → useState + useEffect 方式だと初回レンダーは false で、useEffect 後の
 *     更新を待たないと mobile レイアウトに切り替わらず、1 フレームの
 *     ちらつきや「常に desktop のまま」になる事故が起きる。
 * - matchMedia の change を subscribe するので、画面回転や devtools の
 *   device mode 切り替えにも追随する。
 */
export function useIsMobile(breakpoint = 640): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    [breakpoint]
  )
  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    [breakpoint]
  )
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
