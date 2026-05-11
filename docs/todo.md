# Tokyo Commute Map — 残タスク備忘録

> このファイルは将来の作業候補をストックする備忘録です。
> 商業化フェーズの詳細運用ランブックは [`affiliate-setup.md`](./affiliate-setup.md) を参照。

最終整理日: 2026-05-12

---

## 🔥 商業化 — ASP 申請（主人本人タスク）

実コード統合は完了済み。あとは主人本人がアカウントを取って `.env.local` を埋める段階。

- [ ] **独自ドメイン取得**
  - 推奨: Cloudflare Registrar (.com @ $9.15/年) または ムームードメイン (.com @ ¥1,728/年)
  - A8 審査通過率を上げるために優先
- [ ] **住所方針決定**
  - 推奨: DMM バーチャルオフィス (¥660/月) または レゾナンス (¥990/月)
  - 自宅公開はプライバシーリスク、「請求あり次第開示」は A8 審査通過率 50% 前後
- [ ] **A8.net アカウント登録 → SUUMO 賃貸提携申請**
  - 銀行口座: ゆうちょ / 楽天 / 住信SBI 等の日本国内口座必須
  - 本人確認書類: マイナンバーカード / 運転免許証 / 在留カード
- [ ] **a8mat メディア ID を `.env.local` に追加**
  - `NEXT_PUBLIC_A8_MAT_SUUMO=xxxxxx`
  - 設定するだけで自動的に A8 計測が ON になる（コード変更不要）
- [ ] **法務ページ環境変数を埋める**
  - `OWNER_NAME` / `CONTACT_EMAIL` / `OWNER_ADDRESS` / `OWNER_PHONE` / `NEXT_PUBLIC_SITE_URL`
- [ ] **バリューコマース** + **もしもアフィリエイト** にも展開（任意）

---

## 🎨 機能拡張（コード作業）

### Affiliate 深化
- [ ] **HOME'S / CHINTAI 駅 deep link 反向工程**
  - 現状はトップページへの fallback。SUUMO で確立した
    `build_<asp>_station_map.py` パターンを HOME'S / CHINTAI にも適用
- [ ] **SUUMO 駅マップの定期再生成 cron**
  - `scripts/build_suumo_station_map.py` を月次で実行
  - GitHub Actions schedule + PR 自動化 or 手動運用ルーチン

### 計測・解析
- [ ] **Google Analytics 4 統合 + アフィリエイトボタンのクリック計測**
  - GA4 ID を `.env.local` に追加
  - StationDrawer のボタンクリックで `gtag('event', 'affiliate_click', {...})`
  - Cookie 同意横幅で「すべて承認」を選んだ時のみアクティブ化

### コンテンツ
- [ ] **DetailRow の「家賃目安」「主要路線」「周辺の特徴」データ接続**
  - 現状全部「— (データ未接続)」のプレースホルダ
  - 主要路線: stations.geojson に `line_names` 配列を持たせる
  - 家賃目安: SUUMO スクレイピング or 不動産 API 検討
  - 周辺の特徴: 口コミから自動生成 / 編集人力

---

## 🔧 技術的負債

- [ ] **v3.4 既存 ESLint warning の解消**
  - `app/page.tsx:72` setWelcomeOpen cascading renders → rAF 化
  - `app/page.tsx:81,115` `useState<any[]>` → Supabase 型生成で除去
  - `components/StationDrawer.tsx:66` `useState<any[]>` → 同上
  - `components/StationDrawer.tsx:78` fetchData used-before-declared → declaration 順序入れ替え
- [ ] **Supabase 型自動生成導入**
  - `supabase gen types typescript --project-id wjlcalxdikbksmhwwujw > lib/database.types.ts`
  - 現状 `any[]` を使っている箇所を置き換え
- [ ] **SEO**
  - 各駅ページ（駅単位 URL）の準備（現状 SPA で駅ごとの URL が無い）
  - sitemap.xml + robots.txt

---

## 🌐 ドキュメント

- [ ] **CONTRIBUTING.md** 作成（コントリビュータ向けセットアップガイド）
- [ ] **英訳 README**（GitHub での visibility 向上、`README.en.md` として並置）
- [ ] **データ生成スクリプトの個別 README**
  - `scripts/build_stations_geojson_v3.py` の入出力仕様
  - `scripts/build_suumo_station_map.py` の運用ガイド（再実行頻度・出力検証）

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-12 | 初版作成。商業化フェーズ実装完了後の残タスクを商業化 / 機能拡張 / 技術的負債 / ドキュメントに分類して整理 |
