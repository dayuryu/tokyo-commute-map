# Kayoha — 残タスク備忘録

> このファイルは将来の作業候補をストックする備忘録です。
> 商業化フェーズの詳細運用ランブックは [`affiliate-setup.md`](./affiliate-setup.md) を参照。
> 基礎工程の戦略は [`adr/0002-just-in-time-architecture.md`](./adr/0002-just-in-time-architecture.md) を参照。

最終整理日: 2026-06-06（英語版 (en) 上線 + 全駅名ローマ字化を反映、ドキュメント全体整理）

---

## ⭐ 次に着手する候補（優先度別）

### 🥇 最優先（次 session の起点）
1. **Perf 深掘り — 第 1+2 弾完了 (2026-06-06)、現状は「演出優先」方針の均衡点**
   - 第 1 弾 (`ac9fc6c`): next/font CJK preload 退化 (Shippori 364 切片 ~11MB を preload) を `preload: false` で根治
     + 未使用 weight 700 削除 + welcome 動画 VP9 化 (2.2MB → 896KB)
   - 第 2 弾 (`1fc16d7`): MapView (MapLibre ~350KB) を next/dynamic 化。冷訪問は Welcome 中 MapLibre を一切取得せず、
     回訪は LoadingOverlay 背後で chunk 取得 (CDP で canvas 描画検証済)
   - **線上実測 (ja/mobile 模擬)**: LCP 11.7s → **8.2s** / FCP 2.7s / TBT 60ms / CLS 0 / 初回 JS 242KB / Perf 66
   - **残 LCP の主因は Welcome 演出**: LCP 要素 = tagline の渐入 (render delay ~2.5s)。
     「演出優先・跑分は犠牲」とプロダクト決定 (2026-06-06) のため、これ以上は追わない
   - 将来の小ネタ (任意): Noto SC ×2 render-blocking CSS は ja/en に純損 (Brotli 後 ~66KB、next/font の
     per-locale 分割不可で中工事) / geojson 等 fetch の priority hint / welcome 動画遅延ロード (演出 trade-off)
   - 計測注意: PSI は Accept-Language: en-US のため `/` → 302 `/en` を踏む（en 上線の副作用、現状維持と決定）。
     ローカル / 線上計測時は `--extra-headers` で `{"Accept-Language":"ja"}` 固定すること
2. **Rich Results Test で FAQPage 検証**（運営側 5 分） — push 済の commit `afcba79` の Schema.org JSON-LD が Google に認識されるか
   `search.google.com/test/rich-results` で `https://kayoha.com/to/shinjuku` を測定

### 🥈 次の大物候補（プロダクト方針で 1 つ選ぶ）
- **A: URL 索引リクエスト 30 駅**（運営側手動、1 日 10 quota、3 日で完走） — Search Console で長文 v2 ページの recrawl を加速
- **B: AdSense 申請進める**（運営側手動、審査 1-4 週） — 0 課金ユーザ段階での monetize 立ち上げ
- **C: ~~i18n P2 残~~ 完了（2026-06-08）** — sitemap.ts に /zh・/en URL + hreflang 出力 / Legal は「日本語版が正文」告知 banner（zh・en locale、本文は ja のまま）/ `/to/[slug]` 30 駅を zh・en 完訳（intro + FAQ、destinations_v2/{zh,en}/）+ ページ chrome 多言語化 + per-page hreflang。commits `e05a31b` `3bbe9d3` `b480988` `0768c8c`。詳細は下記「多言語化 i18n」section
- **D: ~~AI 推薦 funnel 計測（GA4 統合）~~ 完了（2026-06-08）** — コード実装 + property 設定 + 線上 E2E 検証まで全部済（下記「計測・解析」参照）。カスタムイベントが標準レポートに出るのは 24-48h 後
- **E: PWA 化** — manifest + service worker、ホーム画面追加体験（1-2 日）
- **F: ~~`/to/[slug]` 4.3MB 調査~~ 解消確認済（2026-06-08）** — 線上実測で再現せず：HTML 65KB / RSC 39KB / JS 合計 0.6MB / ページ総転送 0.44MB（headless 実ブラウザ計測、stations.geojson への fetch ゼロ）、ビルド産物の prerendered HTML も最大 67KB。stations.geojson は server-side `fs.readFile` のみで response に inline されない設計を確認。記録当時（2026-05-24）は next/font CJK preload 退化（`ac9fc6c` で 2026-06-06 根治）の時期で、font 切片の一括 preload を document の重さと誤認した可能性が高い
- **G: A8 申請進める（運営側タスク）** — ドメイン + 住所 + 銀行口座揃ったら申請

### 🥉 余裕がある時の polish
- 真機モバイル多端末 verification（iPhone Safari / Android Chrome）
- mobile UX audit の curtain timing 短縮（900ms→700ms）
- 技術的負債（ESLint warning + Supabase 型自動生成）
- AI 推薦 prompt 改善（production データ蓄積後）
- Sentry 接入（~30 分）
- 旧 `destination_descriptions.json` 削除（page.tsx は読まなくなった、legacy として残してるだけ）

---

## 🌐 多言語化 i18n（ja / en / zh 3 locale 完全上線 — P2 まで完了 2026-06-08）

### 現状（2026-06-08）
- ✅ **骨架完成**：next-intl 4.x + middleware + `/[locale]` ルーティング、localePrefix=as-needed（`/` = ja default、`/zh` = 中文、`/en` = English）
- ✅ **中文 UI 全訳**：P0 + P1 全 component 完了（messages/zh.json は ja.json と key 完全一致）
- ✅ **英語版 (en) 上線**（2026-06-05）：en.json 完訳（ja と key 完全一致）+ 全 1831 駅名・154 路線名の標準式ローマ字化 + UI 全面接線（`lib/station-label.ts`、Drawer 見出しは「Shinjuku 新宿」併記、検索は romaji 入力対応）
- ✅ **字体接入**：Noto Serif SC + Noto Sans SC（簡体専字 fallback バグ解消）+ tagline 中文 italic 修正
- ✅ **言語切替 UI 2 箇所**：Welcome 右上 + HeaderMenu dropdown（ja / EN / 中文 3 択）
- ✅ **切替副作用解決**：next-intl cookie + sessionStorage `welcome_after_switch` flag（Welcome 上切替 → reload 後 Welcome に留まる）
- ✅ **AI 推薦 reason locale-aware**：POST に language param、buildSystemPrompt(lang) で reason を locale に応じて生成、cache key に language 追加
- ✅ **area_features 中文版**：1843 駅分の中文要約を統合済（`area_features_zh.json`、commit `dcc18c3`）。loader は locale-aware + ja fallback

### 完了 commits（時系列）
| Commit | 内容 |
|---|---|
| `ceee7cd` | i18n 骨架 + SSOT 防屎山骨架（lib/storage-keys, types, constants + ADR 0001/0002） |
| `6cd3c20` | P0 7 component 翻訳 |
| `3b540a5` | P1 AI 推薦 reason locale-aware |
| `8836ded` | area_features 基建（loader + `--lang`） |
| `529d9e2` | area_features 手工 paste workflow scripts |
| `dcc18c3` | area_features 中文版 1843 駅統合 |
| `49680cb` `b8a4dee` | Story 物語 3 章中文化 + 字号調整 |
| `e87cf48` | P1 残 4 component 翻訳（TimeSlider / TransferFilter / DestinationPicker / CorrectionReporter） |
| `0e0dc7d` | Metadata 多言語化（generateMetadata + x-default canonical + hreflang） |
| `4fa3197` | **英語 locale 有効化** — en.json 完訳 + EN UI 復活（2026-06-05） |
| `e3bd913` | 全 1831 駅名 + 154 路線名ローマ字化（`generate_station_names_en.py` + データ 2 ファイル） |
| `95f8fb8` | EN 駅名・路線名・目的地名を UI 全面接線（`lib/station-label.ts` 新設） |

### 中文半成品処理方針（決定 2026-05-21）

**Option 3 採用** — 核心 user path 優先翻訳 + 二級コンテンツ ja-fallback 表示。

> 中国の小紅書からの流入があるため `/zh` 公開停止は NG。代わりに DestinationAsk +
> AI 推薦 path を最優先で翻訳し、深層コンテンツ（Story 物語 / 法務 / SEO landing 等）は
> 翻訳完了まで日文表示のままにする。中文版は「中日混合 beta 状態」だが、main map UX で
> 完結する path のみ翻訳が間に合うよう優先順位を組む。

P0 完了時点で「i18n 進行中」banner を中文版に出すか運営側と再協議（現状では出さない）。

### P0 — 主要 user-facing（小紅書流入時に最初に見る箇所） ✅ 完了 (commit `6cd3c20`)
- [x] DestinationAsk 6 問翻訳
- [x] AiWizard 6 問翻訳（一問一屏 editorial の各 question / option / loading copy）
- [x] AiResultGrid 結果カード + reason placeholder 翻訳
- [x] AiRecallButton attention tooltip 翻訳
- [x] StationDrawer 主要 section 翻訳（評価フォーム / 通勤時間 / Affiliate / 周辺特徴 header）
- [x] LoadingOverlay 翻訳
- [x] CookieConsent 翻訳
- [x] AI 推薦 reason 中文化（locale-aware backend、commit `3b540a5`）

### P1 — 完了
- [x] Story 物語 3 章翻訳（commit `49680cb` + `b8a4dee` 字号調整）
- [x] MapView popup — 監査で user-facing 日文 0 件確認、改修不要（commit `e87cf48` 補足）
- [x] TimeSlider / TransferFilter / DestinationPicker / CorrectionReporter（commit `e87cf48`、4 namespace + ja/zh 同期）
- [x] Metadata 多言語化 (canonical / og:url / og:locale を generateMetadata で locale 依存に切替、commit `0e0dc7d`)

### P2 — SEO / 法務 / 国際化深層（2026-06-08 完了）
- [x] **sitemap.ts hreflang + `/zh`・`/en` URL 出力**（commit `e05a31b` メインページ + `0768c8c` /to/ 30 駅）。ja を代表 entry に ja/zh/en 相互 hreflang（x-default = ja）。legal 深層は ja のみ据え置き（重複コンテンツ回避）
- [x] **Legal 多言語対応**（commit `3bbe9d3`）。特商法・プライバシー等は日本法令準拠のため日本語が正文。zh / en locale では legal layout 冒頭に「日本語版が正文」告知 banner を出し、本文は ja のまま。`lib/static-messages.ts` 経由で SSG 維持（next-intl server API は dynamic 退化のため不採用）。**機械翻訳禁止の本文翻訳はせず、告知方式を採用**
- [x] **`/to/[slug]` SEO landing 30 頁 zh・en 完訳**（commit `b480988`）。intro + FAQ を `destinations_v2/{zh,en}/` に配置、`loadDestinationV2(slug, locale)` が locale 別 → ja graceful fallback。ページ chrome（title / stats / FAQ 見出し / CTA / footer / 他駅リスト）は messages `toLanding` namespace + `lib/static-messages.ts` で多言語化（SSG 維持）。EN は駅名ローマ字 + ¥ 表記家賃、canonical は ja URL 統一 + per-page hreflang

### P3 — 大物 / 戦略（完了）
- [x] **area_features 中文版** — 2026-05-22 完了（commit `dcc18c3`）。`generate_area_features_prompts.py` で 47 batch prompt を生成 → 外部 LLM で翻訳 → `merge_area_features_responses.py --lang zh` で `area_features_zh.json` 統合。loader は zh 版が無い駅は ja 版に graceful fallback
- [x] **英文版（en）復活 + 全コンテンツ翻訳** — 2026-06-05 完了（commits `4fa3197` `e3bd913` `95f8fb8`）。en.json 完訳 + 全駅名・路線名ローマ字化 + UI 全面接線。残る EN 深層コンテンツ（Legal / `/to/[slug]` / area_features 英文版）は P2 へ統合

### 翻訳方針
- UI 文案は母語クオリティで初訳 → 運営側レビュー
- 量が多い時（Story / AreaFeatures 等）は外部 LLM 初訳 → 運営側レビューも併用
- 法務文案は機械翻訳禁止、人手翻訳のみ

---

## 🏗️ 基礎工程（防屎山骨架・Just-In-Time Architecture）

プロダクト方針（2026-05-21 決定）：**Airbnb tier ではなく「小型商業 tier」基建で十分**。
詳細戦略は [`adr/0002-just-in-time-architecture.md`](./adr/0002-just-in-time-architecture.md)（実施時に作成）。

### 5 大反屎山原則
1. **Single Source of Truth** — 1 つの事実は 1 箇所だけに定義
2. **Content vs Presentation 分離** — 文案 / 設計 token / ロジックは別レイヤー
3. **Domain Layering** — `app/ → components/ → lib/ → data/` 単向依赖、逆方向 import 禁止
4. **Type-Driven Boundaries** — 跨文件型の境界には型 + 可能なら zod 等の runtime 校验
5. **Convention over Configuration but Documented** — 決定は ADR に書く

### P0 — A 清单（半日工事、必做、最高 ROI）✅ 完了 (2026-05-21)
- [x] `lib/storage-keys.ts` — localStorage / sessionStorage key 集中管理
- [x] `lib/types/` — `app/[locale]/page.tsx` が export していた type を抽出
- [x] `lib/constants.ts` — magic numbers / 業務常數収納
- [x] `docs/adr/` 目錄建立 + `0001-i18n-next-intl.md` + `0002-just-in-time-architecture.md`
- [x] `CLAUDE.md` 更新（i18n status + 新 lib 構造 + ADR 言及）

### P1 — B 清单（Just-In-Time、pain 発生時に随時）
- [ ] `lib/api/supabase/` 集中 + zod schema 校验（現状 component 内で fetch 散在）
- [ ] `lib/api/openai/` 集中（`app/api/recommend/route.ts` を含む）
- [x] **`page.tsx` 分解** — ADR-0003 Jotai 全面 atom 化で達成（2026-06-04 完了、commit `bcd988f`〜`b31060a`）。
   旧計画の 5 hook（useVisitedState / useAiCache / useStationData / useDestinationMemory / useOverlayChoreography）は
   atom 層 8 file（ui / data / area-features / domain / destination-storage / ai-cache / derived / overlay）+ 2 hook
   （useDataLoaders / useBootstrap）に吸収。page.tsx は 726 → 341 行 (-53%)
- [ ] `components/` 按 feature 分目錄（welcome / map / drawer / ai / chrome / flow）
- [ ] `WelcomeOverlay` 拆 3 個動畫 hook（`useTypewriter` / `useMouseParallax` / `useVideoFreezeFrame`）

### C 清单 — 当前不做（延后到真有需求驱动）
- ✅ ~~Zustand / Jotai~~ → **2026-05-31 起 ADR-0003 で採用、2026-06-04 全段階完了**（`1c9a8a1` 実バグ駆動の Just-In-Time 発動例）
- ❌ design token 系統化（CSS var で十分、inline color 撲滅は over-engineering）
- ❌ Storybook（1 人项目无 ROI、3 人以上で再評価）
- ❌ 自動化テスト framework（手動 verification の方が現状コスパ良）

### D 清单 — 这辈子可能不做（明示）
- ❌ monorepo / microfrontend / DDD 重型版本 / 自定 framework wrapper

---

## 🔥 商業化 — ASP 申請（運営側タスク）

> ⚠️ **収益前提を 2026-06-08 に訂正**（詳細は [`affiliate-setup.md` の「現実チェック」](./affiliate-setup.md)）。
> 旧前提「SUUMO ¥1,000/件 で大きく稼げる」は誤り（¥1,000 はスマイティの値の混同 / SUUMO 賃貸の A8
> 提携可否は非公開）。賃貸アフィリエイトは現トラフィック帯では月数千円級・成果条件が厳しい。
> **主要賃貸広告主は A8 でなくバリューコマース経由が主**（承認率公開・DOOR賃貸 即時提携）。
> ASP 登録は **バリューコマース優先**、過度な期待をせず受動収益層として扱う。注力は広告でなくトラフィック増。

実コード統合は完了済み。あとは運営側でアカウントを取って `.env.local` を埋める段階。

- [ ] **独自ドメイン取得**
  - 推奨: Cloudflare Registrar (.com @ $9.15/年) または ムームードメイン (.com @ ¥1,728/年)
  - A8 審査通過率を上げるために優先
- [ ] **住所方針決定**
  - 推奨: DMM バーチャルオフィス (¥660/月) または レゾナンス (¥990/月)
  - 自宅公開はプライバシーリスク、「請求あり次第開示」は A8 審査通過率 50% 前後
- [ ] **ASP アカウント登録**（バリューコマース優先 → A8.net）→ 賃貸広告主（DOOR賃貸 / HOME'S / SUUMO）の単価・承認率を確認の上で提携申請
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
- [x] **Google Analytics 4 統合 + アフィリエイトボタンのクリック計測**（2026-06-08 コード実装済）
  - `lib/analytics.ts`（trackEvent ラッパー）+ `components/AnalyticsGate.tsx`（同意連動 script 注入）
  - Cookie 同意状態は `lib/atoms/consent.ts` に atom 化 — 「すべて承認」を選んだ瞬間に GA4 活性化
  - イベント一覧: `ai_entry_click` / `ai_wizard_step` / `ai_result_shown` / `ai_error` /
    `ai_result_station_click` / `affiliate_click`（命名と params は lib/analytics.ts の doc comment 参照）
  - [x] **GA4 property 作成 + ID 設定**（2026-06-08 完了）— property「Kayoha」作成、
    `NEXT_PUBLIC_GA4_ID` を Vercel（Production のみ）+ `.env.local` に設定、Redeploy 済。
    線上 E2E 検証 PASS（同意前 0 request → 承認後 gtag.js + /g/collect 確認）
  - [x] **プライバシーポリシー更新**（2026-06-08 完了）— 第 4 条「第三者への提供・委託」に
    Google LLC（アクセス解析）を追記、同意連動の旨も明記

### コンテンツ
- [x] **主要路線データ接続**（2026-05-13 完了）
  - `build_stations_geojson_v3.py` に `load_station_lines()` 追加、`stations.geojson` の `line_names` プロパティとして注入
  - `StationDrawer.tsx:256` で `station.line_names` から表示
- [x] **家賃目安 Phase 1: SUUMO 駅別相場 101 駅（通勤先 30 + 住宅地 71）**（2026-05-13 完了）
  - `public/data/manual_rent_data.json` に 101 駅収録（1R / 1K / 1DK / 1LDK / 2LDK / 3LDK）
  - `lib/manual-rent.ts` から StationDrawer に「12.4 万円〜 · 1LDK 22.7 万円」形式で展開
  - 詳細: [`rent-data-plan.md`](./rent-data-plan.md)
- [x] **家賃目安 Phase 2: 政府住宅統計 baseline**（2026-05-13 完了）
  - e-Stat 統計表 0004021452 から関東 305 市区町村の家賃データ取得
  - station.csv の address を解析 → 1940/2043 駅（95%）に家賃マッピング
  - StationDrawer で SUUMO（101 駅）→ 政府（1940 駅）→ 未収録 の二層 fallback
  - 次回更新は 2028 年（5 年に 1 回の調査）
- [x] **周辺の特徴データ**（2026-05-13 完了）
  - 1843 駅 × 50〜75 字の AI 要約を外部 LLM 経由で batch 生成
  - `public/data/area_features.json` (326KB) + `lib/area-features.ts` loader
  - StationDrawer に AreaFeatureRow として統合、AI 免責文 + 景表法配慮

---

## ✨ AI 駅推薦機能（v1 上線済 — 2026-05-13）

本 phase は完了。

### 実装済（v1）
- ✅ Backend: `app/api/recommend/route.ts` — gpt-5.4-nano + structured outputs
- ✅ Wizard UI: `components/AiWizard.tsx` 6 問（destination + 5 偏好）一問一屏 editorial
- ✅ 結果: `components/AiResultGrid.tsx` 20 駅双列カード grid、hover 主題赤 accent
- ✅ DestinationAsk: AI hero card 入口、24h 利用済み時は「再表示」モードに変身
- ✅ 24h cache + recall: localStorage 永続化、cache 命中は無制限
- ✅ AiRecallButton: 地図左下フロート、attention sequence (pulse + tooltip)
  - 2026-05-13 (PM): hasCache prop による二態化。aiCache=null 時は「AI に聞いてみる」初回 CTA、存在時は「20 駅を再表示」。地図上常駐で「やっぱり AI に聞きたい」user の救済路を担保。
- ✅ StationDrawer: 「← AI 推薦 20 駅に戻る」リンク (該当駅のみ表示)
- ✅ MapView: 選択駅 INK 黒ピン (赤通勤先と区別)、選択時散点 hide で視覚錯位回避
- ✅ Rate limit: 1 device / 24h (cache miss のみカウント、cache hit は無制限)

### v1.1 追加（2026-05-13 Night、`446a9f6` + `5f8730a`）
- [x] **custom destination 解禁** — 任意の 1843 駅を通勤先として AI 推薦できる。
  client Dijkstra 結果を `commuteByCode` として POST 同送する設計。
  AiWizard Q1 に駅名検索 input + autocomplete dropdown 追加、表記揺れ
  正規化（小カナ・「の/が」除去・括弧別名展開）で「四谷 → 四ツ谷(四ッ谷)」
  「霞ヶ関 ↔ 霞ケ関」「丸ノ内 ↔ 丸の内」等にも対応。
- [x] **純商業区 13 駅ブラックリスト** — 大手町・東京・桜田門等の SUUMO 物件
  ほぼ無い駅を `NON_RESIDENTIAL_STATION_CODES` で候補から除外。
  併せて prompt にも「住宅エリア優先」の選定方針を追加。

### 残作業（v2 候補）
- [x] **Phase 5 完全版**: 20 推薦駅を地図上で**一括 highlight**（2026-05-17 実装済み）
  - `lib/atoms/derived.ts` の `aiHighlightFeaturesAtom` → MapView の `stations-ai-highlight` layer
    （主題赤の外環）で、aiCache が 24h 内 fresh の時に 20 駅を地図に常駐表示。
    ズームアウト時に 20 駅の分布が一目で見える
- [x] **AI 推薦 funnel 計測**（GA4 統合の一部、2026-06-08 コード実装済）
  - DestinationAsk「AI に提案」クリック → Wizard 開始 / 離脱（`ai_entry_click` entry=ask_hero）
  - 各 Q1-Q6 通過率（`ai_wizard_step` step=1-6）
  - Loading 完了 / エラー / 結果カードクリック（`ai_result_shown` / `ai_error` / `ai_result_station_click`）
  - Recall 経路の使用率（`ai_entry_click` entry=recall_button / drawer_link, mode=recall）
  - 残: GA4 measurement ID の設定（運営側、「計測・解析」section 参照）
- [ ] **エラー UX の具体化**
  - 現状: 「推薦を取得できませんでした」一律 + タイムアウト時専用 message を追加（v1.1 で）
  - 案: 候補駅 < 20 / OpenAI 失敗 / Rate limit / Network を更に区別、ユーザ向け解決策提示
- [ ] **キャッシュ復元の改善**
  - 現状: localStorage `tcm.ai_cache.v1` に保存、recs + destination + (v1.1) customStation を復元
  - 案: 回答 (WizardAnswers) も保存し、recall 時に「あなたの条件: 〇〇」と表示
- [ ] **AI 推薦結果の共有 (SNS)**
  - URL に answers + recs を encode、家族 / 友人と相談用
  - 個人情報含まない、再現性確保
- [ ] **AI 推薦 prompt 改善** (production データ蓄積後)
  - 1〜2 ヶ月運用 → cache hit 率 / fallback 率 / クリック分布を確認
  - reason 文の論調・長さ調整
- [ ] **server 側 OpenAI fallback の偶発調査** — 開発中の curl テストで稀に
  `fallback=true` が出ることを確認（station_name が validNames に無いケース）。
  実害は少ないが頻度を測って必要なら retry 一回挟む

---

## 📱 モバイル UX 安定化

> プロダクト方針 (2026-05-13): App 化はせず、web 体験を磨き上げる路線。
> 真機 (iPhone Safari) で実際に踏んだ bug + audit で洗い出した既知の坑を集約。

### 完了済（2026-05-13 Night、`b5bde53` `1a266fd` `f232448` `9f4e957`）
- [x] **`100vh` → `100dvh`** — iOS Safari の URL bar 動的高さに追従、画面下端
  コンテンツが隠れる古典 bug を解消。`app/layout.tsx` 含む 5 ファイル統一
- [x] **drawer に `touch-action: pan-y`** — 縦スクロールを browser native に
  委任、map drag や cluster click との touch event 競合解消
- [x] **input fontSize ≥ 16px** — iOS Safari が `<input>` focus 時に
  16px 未満のページを強制 zoom する挙動を防ぐ。5 ファイル（DestinationAsk /
  AiWizard Q1 / CorrectionReporter / DestinationPicker / StationDrawer textarea）
- [x] **StationDrawer close button safe-area** — `env(safe-area-inset-top)`
  対応で iPad split-view / notch 機種で button が隠れない
- [x] **DestinationPicker dropdown max-h** — 窄屏で content が両端から
  cutoff する問題に `min(15rem, calc(100dvh-120px))` で対応
- [x] **`.glass-top` max-width** — tablet 横向き (~800-900px) で control bar
  が画面端から overflow するのを `calc(100vw - 48px)` で防止
- [x] **crypto.randomUUID Secure Context fallback** — HTTP+LAN IP 経由で
  `crypto.randomUUID` が undefined になる罠を `lib/device-id.ts` に 3 段
  fallback を集約して回避（getRandomValues + Math.random）

### 残作業
- [ ] **真機多端末 verification** — iPhone Safari (notch / 非 notch)、
  Android Chrome、iPad split-view で完了済みの全 fix を実機検証
- [ ] **curtain timing 短縮（polish）** — Welcome → DestinationAsk 過渡の
  900ms を 700ms に縮められないか。複数 fade transition が連動するため
  慎重に。stability bug ではなく体感速度の話、優先度は低い
- [ ] **WelcomeOverlay 動画自動再生 fallback の見直し** — iOS Safari は
  user gesture 前は muted video でも autoplay block するケースがある。
  現状の `tryPlayOnGesture` でカバーされているが、稀に first impression
  で静止画のままになる報告があれば対策

---

---

## 🔧 技術的負債

- [x] **ESLint 全エラー・警告の解消**（2026-06-09 完了、commit `8202311`、24 → 0）
  - `<a>`→`next/link`、StationDrawer fetchData を useCallback 前置、reviews を `StationReview`
    interface 型付け、MapView geojson を `StationProps`/`StationFeature` 型化 + MapLibre interop の
    `any` を正確型に、`_` 前缀の未使用許容を eslint.config に追加、mount-once effect の
    exhaustive-deps を理由付き suppress。tsc / eslint ともに 0。挙動不変。
- [ ] **Supabase 型自動生成導入**（任意・未対応）
  - `supabase gen types typescript --project-id wjlcalxdikbksmhwwujw > lib/database.types.ts`
  - 現状 reviews は `StationReview` interface で暫定対応済。完全自動生成は将来任意で
  - 注: `app/[locale]/page.tsx` の旧 `useState<any[]>` / cascading renders 警告は現状 lint 0 件で再現せず（解消済みか別 commit で対応済み）
- [x] **SEO 基盤**（2026-05-19 〜 24 完了）
  - ✅ `sitemap.ts` + `robots.ts` 実装済
  - ✅ `/to/[slug]` 30 駅 SEO ランディングページ + FAQPage JSON-LD
  - ✅ Schema.org structured data
  - ✅ Google Search Console 開設 + sitemap 送信

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

### 推奨ステップ（動機別）

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
| 2026-05-13 (PM) | UI/UX 整理 session: 物語叙事の再構築（A2 平衡）+ Story 第 1 章毛玻璃 + traveler animation 修正 + 大見出し nowrap 守則。AI Advisor の地図上常駐エントリ化（hasCache 双 mode）+ Wizard 退出 CTA。ChatGPT brand 表記 3 箇所追加。bug 修正: 田町等 5 駅の destInfo lookup 括弧後缀対応 / 選択駅 flyTo 確実化 + 桌面 offset / 抽屉 backdrop 削除（地図卡死解消） / handleWizardResolve 余計な 900ms 遅延削除。全駅数 1,793 → 1843 統一 |
| 2026-05-13 (Night) | AI 推薦 v1.1: 純商業区 13 駅黒名单 + custom destination 解禁 + 駅名検索 autocomplete + 表記揺れ正規化（`5f8730a` `446a9f6`）。モバイル UX audit 2 round: 100vh→100dvh / drawer touch-action / input ≥ 16px / safe-area / dropdown / .glass-top / crypto.randomUUID 7 件 fix（`b5bde53` `1a266fd` `f232448` `9f4e957`）。bug: drawer 通勤時間「— 分」表示 + Cookie banner drawer 重なり同時修正。「次に着手する候補（優先度別）」section 新設 |
| 2026-05-21 〜 22 | **i18n 中文化（next-intl 4.x）+ 防屎山骨架 + area_features 中文版完走**（commits `ceee7cd` `6cd3c20` `3b540a5` `8836ded` `529d9e2` `dcc18c3` `49680cb` 他、累計 8 件）。P0 7 component 翻訳 + AI reason locale-aware + Street View OSM 出入口 + Story 中文化 + Drawer 毛玻璃 + spring motion |
| 2026-05-23/24 | **30 駅長文 v2 + FAQPage Schema.org + i18n P1 完走 + canonical 回帰 fix**（commits `afcba79` `e87cf48` `0e0dc7d`）。外部 LLM workflow で 30 駅 × 800-1200 字 + 5 FAQ JSON を一気生成 → `destinations_v2/` 新設、`react-markdown` + `remark-gfm` 追加で `/to/[slug]/page.tsx` 改造、FAQPage JSON-LD 注入。i18n P1 残 4 component（TimeSlider / TransferFilter / DestinationPicker / CorrectionReporter）翻訳、ja/zh top-level keys 12 個完全一致。Google Search Console 開設 + sitemap 送信。Lighthouse 再測で SEO 100 → 92 回帰検出 → `[locale]/layout` を generateMetadata 化、全 locale canonical を x-default に統一 + hreflang alternates 明示で対応 |
| 2026-05-28 | **廃駅 12 件を geojson から除外**（commit `cf0315a`）。地図表示・AI 推薦候補の駅数は 1843 → **1831** に |
| 2026-06-04 | **ADR-0003 Jotai 全面 atom 化 P0-P6 完了**（commits `bcd988f` 〜 `b31060a`）。page.tsx 726 → 341 行 (-53%)、destination ⟺ customStation 不変量を atom 構造で錠掛け |
| 2026-06-05 | **英語版 (en) 上線**（commits `4fa3197` `e3bd913` `95f8fb8`）。en.json 完訳 + 全 1831 駅名・154 路線名の標準式ローマ字化（`generate_station_names_en.py` → `name_en` 注入 + `station_names_en.json` / `line_names_en.json`）+ `lib/station-label.ts` 新設で UI 全面接線（Drawer 併記 / romaji 検索 / EN 目的地名） |
| 2026-06-06 | ドキュメント全体整理（README / todo の駅数 1831 反映、英語版上線状態の同期、i18n section 再構成） |
| 2026-06-06 (夜) | **Perf 深掘り第 1 弾**（commits `ac9fc6c` `93b511b`）。next/font の CJK preload 退化 (Shippori 364 切片 ~11MB を preload) を `preload: false` で根治 + 未使用 weight 700 削除 + welcome 動画 VP9 化 (-60%)。フォント転送 11.97MB → 1.02MB。併せて user-facing copy の駅数 1843 → 1831 全同期（messages 三語 / manifest / landing 30 頁 / credits / 注釈）。PSI の `/` → `/en` 302 問題を特定、localeDetection 現状維持と決定 |
| 2026-06-06 (深夜) | **Perf 第 2 弾: MapView dynamic import**（commit `1fc16d7`）。MapLibre ~350KB を初回バンドルから分離、冷訪問は Welcome 中取得ゼロ・回訪は LoadingOverlay 背後で取得 (CDP 検証済)。線上実測 LCP 11.7 → **8.2s** / TBT 60ms / CLS 0 / 初回 JS 242KB。残 LCP は Welcome 演出由来 (render delay 2.5s) — 「演出優先」方針でここを均衡点とする |
