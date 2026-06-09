'use client'

import { useEffect } from 'react'

/**
 * Service Worker 登録（PWA: オフライン地図キャッシュ + standalone 体験）。
 *
 * - 本番のみ登録（dev で SW がキャッシュすると HMR / 検証が壊れるため）。
 * - `load` 後に登録して初回描画の帯域を奪わない。
 * - 失敗は握り潰す（SW は progressive enhancement、無くても全機能動く）。
 *
 * 実体は public/sw.js。配置は layout の Providers 内（描画には不要だが
 * client boundary 内に置けば十分）。
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* SW 登録失敗は無視（オフライン機能が無効になるだけ） */
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
