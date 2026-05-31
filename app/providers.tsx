'use client'

import { Provider } from 'jotai'
import type { ReactNode } from 'react'

/**
 * Jotai のグローバル store を提供する client boundary。
 *
 * Next.js App Router の SSR では layout が server component のため、module-level
 * の default store をそのまま使うと（理論上）request 間で state が漏れる懸念がある。
 * 明示的に <Provider> を client component として挂载することで、client mount ごとに
 * 独立した store を保証し、将来 store.reset 等が必要になった際の足場も得る。
 *
 * 配置: layout.tsx の NextIntlClientProvider 内側・children 外側。
 * これにより atom を消費する component が useLocale() と同じ React tree 内に居る
 * ことを保証する（locale 依存の data loader と atom 層の整合）。
 *
 * 状態管理方針の詳細は docs/adr/0003-jotai-state-management.md を参照。
 */
export default function Providers({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>
}
