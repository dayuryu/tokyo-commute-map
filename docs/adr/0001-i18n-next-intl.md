# 0001. i18n に next-intl を採用

**Status:** Accepted
**Date:** 2026-05-21

## Context

中国の小紅書での紹介投稿により中文圏流入が急増、`/zh` 公開が事業優先度の最上位
近くまで上がった。当時のサイトは日本語 hardcoded、UI 文字列が 17 component
合計 ~1060 行に散在しており、何らかの i18n 基盤を入れる必要があった。

選定対象の候補：

1. **next-intl** — Next.js App Router 専用設計、middleware + cookie + 自動検出を統合
2. **next-i18next** — Pages Router 時代の標準、App Router 対応は subset
3. **react-i18next** — framework agnostic、Next 統合は手動
4. **format.js (react-intl)** — メッセージフォーマット強力、bundle 大きめ
5. **自前実装** — Context + JSON file (Just-In-Time 的最小実装)

## Decision

**next-intl 4.x を採用**、ファイル構造を `app/[locale]/...` に再編、Next.js 16
の middleware (`proxy.ts`) に next-intl の createMiddleware を載せる。

設定：
- `locales: ['ja', 'zh']`（英文版は別フェーズ、当面 disable）
- `defaultLocale: 'ja'`
- `localePrefix: 'as-needed'` — `/` = ja default、`/zh` = 中文
- `localeDetection: true` — Accept-Language ヘッダ + cookie で自動切替

## Why

1. **Next.js App Router での圧倒的支持**：4.4 で公式に Next.js 16 対応、React
   Server Component と client component の両方で同じ API。
2. **routing + middleware + cookie の 1-stop shop**：自前で `Accept-Language`
   解析 + redirect + cookie 永続化を書くコスト >>> ライブラリ依存追加コスト。
3. **Bundle size ~2KB**：format.js 系より遥かに軽い。
4. **as-needed mode**：default locale は prefix 無しのまま運用できるため、既存
   `/` URL の SEO ランクへの影響をゼロにできる。これは小紅書流入と並行して
   日本語 SEO も維持する事業要件と完全一致。
5. **同梱 navigation helpers**：`Link` / `useRouter` / `usePathname` が locale
   を意識した URL 解決と NEXT_LOCALE cookie 更新を一体化。

代替案を選ばなかった理由：
- **next-i18next**: App Router での type 不一致 + Pages Router 流儀の cruft が
  残る。將來性低い。
- **react-i18next**: middleware / cookie / SSR 連携を自前で書くと結局 next-intl
  相当のコード量になる。
- **format.js**: ICU MessageFormat 機能は強力だが、本プロダクトの文案は単純な
  template string で十分。
- **自前**: SSR の locale negotiation + cookie + middleware を正しく組むには
  数日掛かる。ROI 低い。

## Trade-offs

1. **大規模ファイル移動**：`app/page.tsx` / `app/legal/*` / `app/to/*` を全部
   `app/[locale]/...` 配下に移した。Git history が分裂しやすい。Git の
   `--follow` で多くは追えるが、`git log` の見た目は乱れた。
2. **Typed routes との競合**：Next.js 16 の typed routes は `[locale]` 動的
   セグメントを含む path で型推論が厳しく、`href={pathname as any}` の cast
   が必要な場面がある。これは next-intl 4.x の改善待ち、短期は許容。
3. **Cookie 粘着問題**：user が `/zh` を訪問すると `NEXT_LOCALE=zh` cookie が
   付与され、その後 `/` への素の `<Link>` クリックでも middleware が cookie
   優先で `/zh` に押し戻す。解決には next-intl の Link with `locale` prop か
   `useRouter().replace('/', {locale: 'ja'})` の明示呼出が必須。生 `next/link`
   で書くと言語切替が機能しない罠あり。
4. **メッセージ JSON が増える**：将来 5+ locale 時に管理コスト上昇。headless
   CMS への移行は 5 locale を超えたタイミングで再評価。
5. **app/ root layout が空シェル化**：next-intl は `<html>` / `<body>` を
   `app/[locale]/layout.tsx` に置く流儀、`app/layout.tsx` は `return children`
   だけになる。Next.js docs と一致しない（Next docs は root に html/body 必須
   としているが、実運用上 next-intl pattern で問題なく build 通る）。

## When to revisit

- **多言語数 > 5**（en/zh/ja/ko/de/...）に達した時：headless CMS（Lokalise /
  Crowdin 等）+ i18n キー名 contract をどう運用するか再設計。
- **大半が server component 化**された時：next-intl の RSC API（`getTranslations`）
  と client API（`useTranslations`）の使い分けを ADR で改めて記述。
- **Edge runtime への移行**を検討する時：next-intl の middleware が edge
  互換であることは確認済だが、構成全体の互換性を再確認。
- **next-intl 5.x へのメジャーアップ**：API 破壊変更があれば moving cost
  評価のために本 ADR を更新。

## 関連
- 進行状況 / 未完了タスク: [`../todo.md`](../todo.md) の「🌐 多言語化 i18n」
- 戦略全体: [`./0002-just-in-time-architecture.md`](./0002-just-in-time-architecture.md)
