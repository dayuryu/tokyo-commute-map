'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'tcm.cookie_consent.v1'
type Consent = 'all' | 'necessary'

/**
 * Cookie 同意横幅。
 *
 * 個人情報保護法（改正 2022.4.1 施行）に基づく Cookie 利用同意の取得。
 * 必要 Cookie 以外（解析・広告）はユーザーの明示的な同意があるまで送信しない方針。
 *
 * 動作：
 * - 初回マウント時に localStorage を読む
 * - 未選択（null）の場合のみ横幅を表示
 * - 「必要のみ」「すべて承認」のいずれかで localStorage に保存して非表示化
 * - 親コンポーネント側で mapMounted 等で出すタイミングを制御する
 *   （WelcomeOverlay 表示中は本コンポーネント自体が mount されない設計）
 */
interface Props {
  /** StationDrawer が開いているか。true の時、桌面では左寄せ、モバイルでは非表示にして
   *  drawer に隠れたまま選択を強要されないようにする。drawer を閉じれば再表示。 */
  drawerOpen?: boolean
}

export default function CookieConsent({ drawerOpen = false }: Props) {
  // undefined = まだ localStorage を読んでいない（hydration 待ち）
  // null = 読み終わったが未選択 → 横幅を表示
  // 'all' / 'necessary' = 既に選択済み → 表示しない
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined)

  useEffect(() => {
    // setState を effect の同期パスで呼ぶと React 19+ の set-state-in-effect 警告が
    // 出るため rAF で次フレームに逃がす。視覚的にはユーザは差を感じない。
    const id = requestAnimationFrame(() => {
      let v: string | null = null
      try { v = localStorage.getItem(CONSENT_KEY) } catch {}
      if (v === 'all' || v === 'necessary') setConsent(v)
      else setConsent(null)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function save(value: Consent) {
    try { localStorage.setItem(CONSENT_KEY, value) } catch {}
    setConsent(value)
  }

  // hydration 中 / 既に同意済み の場合は何も描画しない
  if (consent !== null) return null

  // drawer がモバイルで全画面 (w-full < sm:380px) を占めるので、その間 banner は非表示。
  // 桌面 (sm 以上) では drawer 右側 380px を避けて左寄せに切替えて重なりを回避する。
  // drawer を閉じれば次回マウントで自然に再表示される。
  return (
    <div
      role="dialog"
      aria-label="Cookie 同意のお願い"
      className={`fixed z-20
                 left-3 bottom-3
                 ${drawerOpen
                   ? 'right-[392px] hidden sm:block md:left-3 md:translate-x-0 md:w-auto md:max-w-[min(720px,calc(100vw-404px))]'
                   : 'right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(720px,calc(100vw-32px))]'}
                 rounded-2xl
                 px-5 py-4 md:px-6 md:py-5
                 border border-black/[.10]
                 shadow-[0_2px_8px_rgba(0,0,0,.06),0_16px_40px_rgba(0,0,0,.16)]
                 fade-up`}
      style={{
        background: 'rgba(244, 241, 234, 0.94)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        color: 'var(--ink)',
      }}
    >
      <div
        className="smallcaps mb-2"
        style={{ color: 'var(--ink-mute)' }}
      >
        Cookies
      </div>

      <p
        style={{
          fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
          fontSize: 13,
          lineHeight: 1.65,
          color: 'var(--ink)',
          letterSpacing: '.02em',
          margin: 0,
        }}
      >
        当サイトは Cookie を使用し、アフィリエイト広告経由の購買・申込行動を計測することがあります。詳細は{' '}
        <Link
          href="/legal/privacy"
          className="underline"
          style={{ color: 'var(--ink)' }}
        >
          プライバシーポリシー
        </Link>
        {' '}をご確認ください。
      </p>

      <div className="flex gap-2 mt-4 justify-end flex-wrap">
        <button
          onClick={() => save('necessary')}
          className="transition-all hover:opacity-80"
          style={{
            padding: '8px 18px',
            background: 'transparent',
            color: 'var(--ink)',
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: '.06em',
            border: '.5px solid rgba(28,24,18,.30)',
            borderRadius: 0,
            cursor: 'pointer',
          }}
        >
          必要のみ
        </button>
        <button
          onClick={() => save('all')}
          className="transition-all hover:opacity-90"
          style={{
            padding: '8px 18px',
            background: 'var(--ink)',
            color: '#f5e7d2',
            fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: '.06em',
            border: '.5px solid var(--ink)',
            borderRadius: 0,
            cursor: 'pointer',
          }}
        >
          すべて承認
        </button>
      </div>
    </div>
  )
}
