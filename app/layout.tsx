import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '東京圏通勤マップ',
  description: '等時圏で探す、理想の住まい',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="overflow-hidden h-screen w-screen">{children}</body>
    </html>
  )
}
