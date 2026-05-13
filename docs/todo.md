# Tokyo Commute Map — 残タスク備忘録

> このファイルは将来の作業候補をストックする備忘録です。
> 商業化フェーズの詳細運用ランブックは [`affiliate-setup.md`](./affiliate-setup.md) を参照。

最終整理日: 2026-05-13

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
- [x] **主要路線データ接続**（2026-05-13 完了）
  - `build_stations_geojson_v3.py` に `load_station_lines()` 追加、`stations.geojson` の `line_names` プロパティとして注入
  - `StationDrawer.tsx:256` で `station.line_names` から表示
- [x] **家賃目安 Phase 1: 通勤目的地 30 駅の SUUMO 駅別相場**（2026-05-13 完了）
  - `public/data/manual_rent_data.json` に 30 駅収録（1R / 1K / 1DK / 1LDK / 2LDK / 3LDK）
  - `lib/manual-rent.ts` から StationDrawer に「12.4 万円〜 · 1LDK 22.7 万円」形式で展開
  - 詳細: [`rent-data-plan.md`](./rent-data-plan.md)
- [x] **家賃目安 Phase 2: 政府住宅統計 baseline**（2026-05-13 完了）
  - e-Stat 統計表 0004021452 から関東 305 市区町村の家賃データ取得
  - station.csv の address を解析 → 1940/2043 駅（95%）に家賃マッピング
  - StationDrawer で SUUMO（101 駅）→ 政府（1940 駅）→ 未収録 の二層 fallback
  - 次回更新は 2028 年（5 年に 1 回の調査）
- [x] **周辺の特徴データ**（2026-05-13 完了）
  - 1843 駅 × 50〜75 字の AI 要約を Claude.ai 経由（妹妹 = 小雪）で batch 生成
  - `public/data/area_features.json` (326KB) + `lib/area-features.ts` loader
  - StationDrawer に AreaFeatureRow として統合、AI 免責文 + 景表法配慮

---

## ✨ AI 駅推薦機能（v1 上線済 — 2026-05-13）

本 phase は完了。設計詳細は [`ai-advisor-plan.md`](./ai-advisor-plan.md) 参照。

### 実装済（v1）
- ✅ Backend: `app/api/recommend/route.ts` — gpt-5.4-nano + structured outputs
- ✅ Wizard UI: `components/AiWizard.tsx` 6 問（destination + 5 偏好）一問一屏 editorial
- ✅ 結果: `components/AiResultGrid.tsx` 20 駅双列カード grid、hover 主題赤 accent
- ✅ DestinationAsk: AI hero card 入口、24h 利用済み時は「再表示」モードに変身
- ✅ 24h cache + recall: localStorage 永続化、cache 命中は無制限
- ✅ AiRecallButton: 地図左下フロート、attention sequence (pulse + tooltip)
- ✅ StationDrawer: 「← AI 推薦 20 駅に戻る」リンク (該当駅のみ表示)
- ✅ MapView: 選択駅 INK 黒ピン (赤通勤先と区別)、選択時散点 hide で視覚錯位回避
- ✅ Rate limit: 1 device / 24h (cache miss のみカウント、cache hit は無制限)

### 残作業（v2 候補）
- [ ] **Phase 5 完全版**: 20 推薦駅を地図上で**一括 highlight**
  - 現状: 選択中 1 駅のみ黒ピン
  - 案: aiCache.recs 内の駅は散点 stroke を太く（赤縁取り）/ 別 layer で星マーク
  - これで地図ズームアウト時に 20 駅の分布が一目で見える
- [ ] **AI 推薦 funnel 計測**（GA4 統合の一部）
  - DestinationAsk「AI に提案」クリック → Wizard 開始 / 離脱
  - 各 Q1-Q6 通過率
  - Loading 完了 / エラー / 結果カードクリック
  - Recall 経路の使用率
- [ ] **エラー UX の具体化**
  - 現状: 「推薦を取得できませんでした」一律
  - 案: 候補駅 < 20 / OpenAI タイムアウト / Rate limit を区別、ユーザ向け解決策提示
- [ ] **キャッシュ復元の改善**
  - 現状: localStorage `tcm.ai_cache.v1` に保存、recs だけ復元
  - 案: 回答 (WizardAnswers) も保存し、recall 時に「あなたの条件: 〇〇」と表示
- [ ] **AI 推薦結果の共有 (SNS)**
  - URL に answers + recs を encode、家族 / 友人と相談用
  - 個人情報含まない、再現性確保
- [ ] **AI 推薦 prompt 改善** (production データ蓄積後)
  - 1〜2 ヶ月運用 → cache hit 率 / fallback 率 / クリック分布を確認
  - reason 文の論調・長さ調整

---

## 🌍 多言語化 (i18n) — 次の大物候補

> 主人方針 (2026-05-13): プロダクトは「面向所有人」(日本人 / 在日外国人 / 海外移住検討者)
> 多言語化は中期 roadmap、優先度は AI 推薦 funnel 計測の後。

候補方針:
- next-intl / next-i18next / 自前 dictionary
- 対応言語: 日本語 (現状) → 英語 → 中文 → 韓国語 ?
- 駅名はそのまま、UI / Story / Welcome / AI 出力言語切替
- AI 推薦の reason は OpenAI に多言語 prompt 渡せば対応可能
- 工時見積: 框架 + 日↔英 = 2-3 セッション、各追加言語 = 1 セッション

最初の作業候補:
- [ ] i18n 框架選定 (next-intl 推奨、App Router 対応最新)
- [ ] dictionary 抽出 (UI 文字を t() 化)
- [ ] LangSwitcher コンポーネント
- [ ] AI 推薦 prompt の lang パラメータ追加

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

## 📱 App 化検討メモ

> 2026-05-12 時点では「現状は web のみで運用、App 化は将来検討」と決定。
> 将来再検討する際に下記の比較をそのまま流用できるようストック。

### 4 つの路線（工時・コスト・体験のトレードオフ）

| 路線 | 工時 | 直接コスト | 体験 | 主な強み / 弱み |
|---|---|---|---|---|
| **A. PWA**（manifest + service worker） | **1-2 日** | **$0/年** | 接近原生（iOS 制限大） | 「ホーム画面に追加」だけで app らしくなる。App Store には出ない。iOS 16.4 未満は push 不可 |
| **B. Capacitor wrap**（現 web を native パッケージ化） | **1-2 週** | **¥15,000/年** (iOS $99/年 + Android $25 一回) | 接近原生（webview） | **App Store / Google Play に上架**。コード 90% 共有。更新ごとに審査 |
| **C. React Native 書き換え** | **4-8 週** | 同上 + 二重保守 | 接近原生（真の RN） | UI 全書き換え。MapLibre は native 版に。維持コスト 2 倍 |
| **D. Swift + Kotlin フル native** | **3-6 ヶ月** | 同上 + 二重精力 | 最良 | indie 開発者には実質不可能。**非推奨** |

### 推奨ステップ（主人の動機別）

| 動機 | 推奨 |
|---|---|
| ホーム画面アイコン + app 感 | **A. PWA** |
| App Store / Google Play で発見されたい | **B. Capacitor** |
| Push 通知（特に iOS） | **B. Capacitor** |
| オフライン対応（地下鉄内など） | **A. PWA** + service worker cache |
| In-app purchase / 課金 | **B. Capacitor**（必須） |
| 「app の方が professional」と感じる | **A. PWA** から試す |

### Capacitor 路線の詳細コスト（将来採用時の参考）

**直接費用（年額）**:
- Apple Developer Program: ¥15,000/年（$99）
- Google Play Developer: ¥3,750（$25、一回限り）
- Push (FCM + APNs): 無料
- アイコン・スプラッシュ外注: ¥0-50,000（自作なら無料）

**工時内訳（1-2 週、約 7-9 営業日）**:
- Next.js → 静的 export 化（SSR 除去）: 1 日
- Capacitor 初期化 + iOS / Android プロジェクト: 0.5 日
- アイコン + スプラッシュ + 起動アニメ: 1 日
- viewport / safe area 調整（iPhone notch 対応など）: 1 日
- Supabase 跨域 / native auth flow: 1 日
- iOS 実機テスト + デバッグ: 2 日
- Android 実機テスト + デバッグ: 1 日
- App Store 提出資料（スクショ・説明・プライバシー）: 1 日
- 審査待ち: **1-2 週**（工時ではないが時間がかかる）

**隠れコスト**:
- メジャー更新ごとに審査（1-3 日待ち）
- iOS 17+ Privacy Manifest 強制（SDK 一覧の申告）
- 個人情報収集ルール申告（/legal/privacy と整合）
- web + app の二重ビルドフロー保守

### 結論（2026-05-12 時点）

早期 MVP / 0 課金ユーザ / 0 月活の段階では、まず **PWA**（1-2 日）で
「ホーム画面に追加できる」体験を整え、ユーザ数が 100+ 月活に達した
時点で **Capacitor** で上架を検討するのが合理的。
React Native / フル native 書き換えは **永続的に非推奨**。

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
| 2026-05-13 | AI 駅推薦 v1 上線（Wizard + cache + recall + 1/day rate-limit）、周辺の特徴データ完了。v2 候補 + 多言語化 i18n 候補追加 |
