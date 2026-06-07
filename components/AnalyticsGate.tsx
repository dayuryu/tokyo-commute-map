'use client'
import Script from 'next/script'
import { useAtomValue } from 'jotai'
import { cookieConsentAtom } from '@/lib/atoms/consent'
import { GA4_ID } from '@/lib/analytics'
import { useBootstrapConsent } from '@/hooks/useBootstrap'

/**
 * Cookie 同意に連動して GA4 script を注入する gate。
 *
 * - 同意 = 'all' かつ NEXT_PUBLIC_GA4_ID が設定済みの時**だけ** gtag.js を読む。
 *   「必要のみ」/ 未選択では解析 script を一切送信しない（プライバシーポリシーの
 *   「明示的な同意があるまで送信しない」方針の実装箇所）。
 * - CookieConsent 横幅で「すべて承認」を押した瞬間、atom 連動でこの component が
 *   re-render され GA4 が活性化する（リロード不要）。
 * - 配置は layout.tsx の <Providers> 内側 — CookieConsent と同じ Jotai store を
 *   購読するための必須条件。
 */
export default function AnalyticsGate() {
  useBootstrapConsent()
  const consent = useAtomValue(cookieConsentAtom)

  if (consent !== 'all' || !GA4_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}', { anonymize_ip: true });`}
      </Script>
    </>
  )
}
