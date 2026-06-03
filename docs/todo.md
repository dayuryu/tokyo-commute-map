# Kayoha — 残タスク備忘録

> このファイルは将来の作業候補をストックする備忘録です。
> 商業化フェーズの詳細運用ランブックは [`affiliate-setup.md`](./affiliate-setup.md) を参照。
> 基礎工程の戦略は [`adr/0002-just-in-time-architecture.md`](./adr/0002-just-in-time-architecture.md) を参照。

最終整理日: 2026-06-04（ADR-0003 Jotai 全面 atom 化 P0-P6 完了、page.tsx 726→341 行 -53%）

---

## ⭐ 次に着手する候補（優先度別）

### 🥇 最優先（次 session の起点）
1. **Perf 深掘り session（LCP 11.7s → 3s 目標）** — Lighthouse Mobile/Desktop Perf 65 から動かない最大の根因が LCP。culprit 候補:
   - i18n routing による `/` → `/ja` redirect 385ms（middleware optimize / rewrite 化検討）
   - 未使用 JavaScript 280ms（chunk splitting / dynamic import / Tree shake）
   - welcome-bg.mp4 (2.27MB) を WebM/AV1 圧縮で半減
   - フォント chunk ~120 個 / ~7MB を self-host + subset 強化
   - MapLibre dynamic import で初回 chunk 軽量化
2. **Rich Results Test で FAQPage 検証**（主人 5 分） — push 済の commit `afcba79` の Schema.org JSON-LD が Google に認識されるか
   `search.google.com/test/rich-results` で `https://kayoha.com/to/shinjuku` を測定

### 🥈 次の大物候補（プロダクト方針で 1 つ選ぶ）
- **A: URL 索引リクエスト 30 駅**（主人手動、1 日 10 quota、3 日で完走） — Search Console で長文 v2 ページの recrawl を加速
- **B: AdSense 申請進める**（主人手動、審査 1-4 週） — 0 課金ユーザ段階での monetize 立ち上げ
- **C: i18n P2 残**（sitemap.ts に /zh URL 追加 + hreflang annotation、Legal 中文版、`/to/[slug]` の中文版 generation）
- **D: AI 推薦 funnel 計測（GA4 統合）** — DestinationAsk クリック → Wizard → 結果カードクリック / Recall 経路 計測
- **E: PWA 化** — manifest + service worker、ホーム画面追加体験（1-2 日）
- **F: `/to/[slug]` 4.3MB 調査** — response が異常に大きい原因不明、stations.geojson inline 疑い（30-60 分）
- **G: A8 申請進める（運営側タスク）** — ドメイン + 住所 + 銀行口座揃ったら申請

### 🥉 余裕がある時の polish
- 真機モバイル多端末 verification（iPhone Safari / Android Chrome）
- mobile UX audit の curtain timing 短縮（900ms→700ms）
- 技術的負債（ESLint warning + Supabase 型自動生成）
- AI 推薦 prompt 改善（production データ蓄積後）
- Sentry 接入（凛 ~30 分）
- 旧 `destination_descriptions.json` 削除（page.tsx は読まなくなった、legacy として残してるだけ）

---

## 🌐 多言語化 i18n（進行中 — 2026-05-21 着手 / 2026-05-22 P0+P1 AI reason 完了）

### 現状（2026-05-22）
- ✅ **骨架完成**：next-intl 4.x + middleware + `/[locale]` ルーティング、localePrefix=as-needed（`/` = ja default、`/zh` = 中文）
- ✅ **10 component 翻訳済**：HeaderMenu / Legend / WelcomeOverlay / DestinationAsk / AiWizard / AiResultGrid / AiRecallButton / StationDrawer / LoadingOverlay / CookieConsent
- ✅ **字体接入**：Noto Serif SC + Noto Sans SC（簡体専字 fallback バグ解消）+ tagline 中文 italic 修正
- ✅ **言語切替 UI 2 箇所**：Welcome 右上 + HeaderMenu dropdown（segmented control）
- ✅ **切替副作用解決**：next-intl cookie + sessionStorage `welcome_after_switch` flag（Welcome 上切替 → reload 後 Welcome に留まる）
- ✅ **AI 推薦 reason 中文化**：POST に language param、buildSystemPrompt(lang) で reason を locale に応じて生成、cache key に language 追加
- ✅ **area_features 基建**：locale-aware loader + script `--lang` flag + 手工 paste workflow scripts。データは主人 → 小雪 で生成待ち
- ⚠️ **英文版（en）暂停**：locales = `['ja', 'zh']`、`messages/en.json` 保留（復活時 routing 戻すだけ）

### 完了 commits（時系列）
| Commit | 内容 |
|---|---|
| `ceee7cd` | i18n 骨架 + SSOT 防屎山骨架（lib/storage-keys, types, constants + ADR 0001/0002） |
| `6cd3c20` | P0 7 component 翻訳 |
| `3b540a5` | P1 AI 推薦 reason locale-aware |
| `8836ded` | area_features 基建（loader + `--lang`） |
| `529d9e2` | area_features 手工 paste workflow scripts |

### 中文半成品処理方針（決定 2026-05-21）

**Option 3 採用** — 核心 user path 優先翻訳 + 二級コンテンツ ja-fallback 表示。

> 中国の小紅書からの流入があるため `/zh` 公開停止は NG。代わりに DestinationAsk +
> AI 推薦 path を最優先で翻訳し、深層コンテンツ（Story 物語 / 法務 / SEO landing 等）は
> 翻訳完了まで日文表示のままにする。中文版は「中日混合 beta 状態」だが、main map UX で
> 完結する path のみ翻訳が間に合うよう優先順位を組む。

P0 完了時点で「i18n 進行中」banner を中文版に出すか主人と再協議（現状では出さない）。

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

### P2 — SEO / 法務 / 国際化深層（残）
- [ ] sitemap.ts hreflang + `/zh` URL 出力（現状 sitemap は ja のみ）
- [ ] Legal 4-5 頁中文版（合規要件あり、機械翻訳禁止、主人 + 凛人手翻訳のみ）
- [ ] `/to/[slug]` SEO landing 30 頁中文版（同じ Opus + Artifact workflow を zh 用に再利用、stats は ja と同じで prompt の言語切替のみ）

### P3 — 大物 / 戦略
- [ ] **area_features 中文版（進行中、主人手工 paste path）** — 当初 CLI subprocess で自動化しようとしたが 1200s timeout に阻まれ失敗。`scripts/generate_area_features_prompts.py` で 47 batch_NN.md を生成済、`_handoff/zh_translation_for_xiaoyuki/` パックに整理済。主人が小雪 (Claude.ai Project / cowork) に投げて 47 batch の JSON を回収 → `_handoff/zh_responses/batch_NN.json` に保存 → `merge_area_features_responses.py --lang zh` で `public/data/area_features_zh.json` 統合。loader は zh 版が無ければ ja 版に graceful fallback するため、データ無くても /zh は動作する
- [ ] 英文版（en）復活 + 全コンテンツ翻訳（layout 調整 / button label / Legend ラベル幅）

### 翻訳方針
- MVP 段階の中文文案は本小姐（凛）が母語クオリティで初訳 → 主人レビュー
- 量が多い時（Story / AreaFeatures 等）は外部 LLM 初訳 → 主人レビューも併用
- 法務文案は機械翻訳禁止、主人 + 本小姐人手翻訳のみ

---

## 🏗️ 基礎工程（防屎山骨架・Just-In-Time Architecture）

主人決定（2026-05-21）：**Airbnb tier ではなく「小型商業 tier」基建で十分**。
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
- ❌ 自動化テスト framework（主人が手動 verification する方が現状コスパ良）

### D 清单 — 这辈子可能不做（明示）
- ❌ monorepo / microfrontend / DDD 重型版本 / 自定 framework wrapper

---

## 🔥 商業化 — ASP 申請（運営側タスク）

実コード統合は完了済み。あとは運営側でアカウントを取って `.env.local` を埋める段階。

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

- [ ] **v3.4 既存 ESLint warning の解消**
  - `app/[locale]/page.tsx` setWelcomeOpen cascading renders → rAF 化
  - `app/[locale]/page.tsx` `useState<any[]>` → Supabase 型生成で除去
  - `components/StationDrawer.tsx` `useState<any[]>` → 同上
  - `components/StationDrawer.tsx` fetchData used-before-declared → declaration 順序入れ替え
- [ ] **Supabase 型自動生成導入**
  - `supabase gen types typescript --project-id wjlcalxdikbksmhwwujw > lib/database.types.ts`
  - 現状 `any[]` を使っている箇所を置き換え
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
| 2026-05-23/24 | **30 駅長文 v2 + FAQPage Schema.org + i18n P1 完走 + canonical 回帰 fix**（commits `afcba79` `e87cf48` `0e0dc7d`）。Opus 4.7 + claude.ai Project + Artifact workflow で 30 駅 × 800-1200 字 + 5 FAQ JSON を一気生成 → `destinations_v2/` 新設、`react-markdown` + `remark-gfm` 追加で `/to/[slug]/page.tsx` 改造、FAQPage JSON-LD 注入。i18n P1 残 4 component（TimeSlider / TransferFilter / DestinationPicker / CorrectionReporter）翻訳、ja/zh top-level keys 12 個完全一致。Google Search Console 開設 + sitemap 送信。Lighthouse 再測で SEO 100 → 92 回帰検出 → `[locale]/layout` を generateMetadata 化、全 locale canonical を x-default に統一 + hreflang alternates 明示で対応 |
