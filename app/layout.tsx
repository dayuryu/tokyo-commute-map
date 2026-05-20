import type { ReactNode } from 'react'
import './globals.css'

/**
 * Root layout — next-intl の i18n routing 構成では html/body/<head> は
 * すべて `app/[locale]/layout.tsx` が担当する。
 *
 * ここでルートが必要なのは Next.js が `app/layout.tsx` の存在を要求するため
 * (and to host a future root-level `not-found.tsx`)。子の `[locale]/layout` が
 * <html> を提供する想定で children を素通しする。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
