# Kayoha (通葉)

> 次の駅で、暮らしをめくる。 — 通勤時間で東京圏の駅を可視化する地図。

**Live**: https://kayoha.com/

通勤時間ベースで「どこに住むか」を直感的に決められる地図ツールです。
東京圏 1831 駅を通勤所要時間で色分けし、駅をクリックすると通勤詳細・AI 推薦・家賃目安・周辺の特徴・コミュニティ評価・物件検索リンクが表示されます。

---

## 特長

- 🗺️ **等時圏マップ** — 30 の主要目的地 + 任意のカスタム目的地への通勤時間で 1831 駅を 6 段階にカラーリング
- 📊 **GTFS 真実時刻表** — 22 運営事業者の公開時刻表データから算出（rush-hour プールメディアン方式）
- 🤖 **AI 駅推薦** — 6 問の偏好 Wizard → OpenAI が 20 駅を提案、地図上に一括ハイライト表示
- 💰 **家賃目安** — SUUMO 101 駅の駅別相場 + 政府統計 1940 駅の区平均家賃（二層 fallback）
- 🏘️ **周辺の特徴** — 全駅に AI 生成の街紹介テキスト（日本語 + 中文）
- 👥 **コミュニティ評価** — 物価・治安・電車混雑の 10 点スコア投稿 + 通勤時間訂正報告
- ⭐ **お気に入り駅** — 駅を ★ で保存（最大 30 駅、localStorage）。地図に常駐表示 + 通勤時間つきリストで比較
- 🏠 **物件検索連携** — SUUMO / HOME'S / CHINTAI 駅単位 deep link で迅速な物件探しへ
- 🌐 **多言語対応** — 日本語 / English / 中文、next-intl による `[locale]` ルーティング + 全駅名・路線名のローマ字表記（EN）
- 📄 **目的地ページ** — 30 駅の長文 SEO/AEO コンテンツ + FAQ 構造化データ
- 📱 **モバイル最適化** — dvh viewport + responsive layout + タッチジェスチャー + safe area 対応

---

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| i18n | next-intl（`[locale]` ルーティング / ja・en・zh） |
| Styling | Tailwind CSS v4 + Springs editorial palette |
| Map | MapLibre GL JS + OpenFreeMap liberty style |
| AI | OpenAI API (gpt-5.4-nano) + react-markdown |
| Backend | Supabase (PostgreSQL + Row-Level Security) |
| Deploy | Vercel |

---

## 開発

```bash
git clone https://github.com/dayuryu/tokyo-commute-map.git
cd tokyo-commute-map
npm install

# .env.local を作成（後述）
npm run dev   # → http://localhost:3000
```

### 環境変数 (`.env.local`)

```env
# 必須 — Supabase 接続
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# 必須 — AI 駅推薦 (OpenAI)
OPENAI_API_KEY=<your-openai-api-key>

# 任意 — アフィリエイト計測 (A8.net media ID)
NEXT_PUBLIC_A8_MAT_SUUMO=
NEXT_PUBLIC_A8_MAT_HOMES=
NEXT_PUBLIC_A8_MAT_CHINTAI=

# 任意 — 法務ページ運営者情報
OWNER_NAME=
OWNER_ADDRESS=
OWNER_PHONE=
CONTACT_EMAIL=
NEXT_PUBLIC_SITE_URL=
```

> AI 推薦機能は `OPENAI_API_KEY` 未設定時にエラーを返します。
> アフィリエイト系・運営者情報系は未設定でもアプリは動作します。
> アフィリエイト未設定時は各 ASP の通常 URL に遷移し、運営者情報は法務ページで安全な fallback が表示されます。

---

## データ生成スクリプト

### 駅 + 通勤時間データ — `stations.geojson` + `graph.json`

GTFS 公開時刻表からの本格的な通勤時間計算（rush-hour プールメディアン）。

```bash
# 前提: ../station_database リポジトリが必要（CC BY 4.0）
# gtfs_cache/ は初回実行時に自動ダウンロード（22 事業者 / 数百MB）
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_stations_geojson_v3.py \
  ../station_database ./gtfs_cache
cp stations.geojson graph.json public/data/
```

出力:
- `public/data/stations.geojson` (1831 駅 + 30 destinations の通勤時間)
- `public/data/graph.json` (隣接グラフ、カスタム目的地の client-side Dijkstra 用)

### SUUMO 駅 deep link — `suumo_stations.json`

SUUMO 賃貸の沿線ページから駅単位の `ek_<id>?rn=<rn>` URL を抽出。

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_suumo_station_map.py
```

出力: `public/data/suumo_stations.json` (1,576 駅)

> SUUMO サーバへの配慮として 1.2 秒間隔のスリープ付きクロール。所要時間 5〜10 分程度。

### その他のデータ生成

| スクリプト | 出力 | 説明 |
|---|---|---|
| `build_government_rent_data.py` | `government_rent_data.json` | e-Stat 総務省の家賃統計 |
| `build_station_government_rent.py` | `station_government_rent.json` | 駅 ↔ 家賃データの紐付け |
| `build_station_pref.py` | `station_pref.json` | 駅 ↔ 都道府県マッピング |
| `build_station_entrances.py` | `station_entrances.json` | OSM 駅出入口座標 |
| `build_line_styles.py` | `line_styles.json` | 路線カラー・スタイル |
| `generate_area_features.py` | `area_features.json` | AI 生成の周辺特徴テキスト |
| `generate_station_names_en.py` | `station_names_en.json` / `line_names_en.json` | 駅名・路線名の標準式ローマ字（EN 表示用、`stations.geojson` に `name_en` を注入） |

---

## ディレクトリ構成

```
tokyo-commute-map/
├── app/
│   ├── layout.tsx              — root シェル（i18n routing の children pass-through）
│   ├── globals.css             — MapLibre + Springs editorial palette tokens
│   ├── sitemap.ts / robots.ts  — SEO
│   ├── api/recommend/          — AI 推薦 API endpoint (OpenAI + Supabase)
│   └── [locale]/               — next-intl i18n routing (ja / en / zh)
│       ├── layout.tsx          — html/body + fonts + metadata + JSON-LD
│       ├── page.tsx            — メインマップページ（orchestrator、状態は lib/atoms/）
│       ├── legal/              — 法務 5 ページ (commerce / privacy / ads / contact / credits)
│       └── to/[slug]/          — 30 駅 SEO ランディングページ + FAQ Schema.org
├── components/                 — 17 コンポーネント
│   ├── MapView.tsx             — MapLibre 地図 + cluster + Dijkstra + AI highlight + お気に入り ★
│   ├── StationDrawer.tsx       — 駅ドロワー（通勤 + 家賃 + 周辺特徴 + 評価 + 物件検索 + ★ toggle）
│   ├── FavoritesPanel.tsx      — お気に入り駅リスト（通勤時間つき、HeaderMenu から開く）
│   ├── AiWizard.tsx            — AI 推薦 6 問 Wizard
│   ├── AiResultGrid.tsx        — AI 推薦 20 駅カード grid
│   ├── AiRecallButton.tsx      — AI 推薦結果の再表示フロートボタン
│   ├── DestinationAsk.tsx      — 通勤先選択（+ AI 推薦入口）
│   ├── DestinationPicker.tsx   — 30 fixed + custom 目的地切替
│   ├── WelcomeOverlay.tsx      — オンボーディング 1 段目
│   ├── Story.tsx               — オンボーディング 2 段目（3 章物語）
│   ├── HeaderMenu.tsx          — 右上ハンバーガーメニュー
│   ├── Legend.tsx              — 通勤時間凡例
│   ├── TimeSlider.tsx          — 通勤時間絞り込み
│   ├── TransferFilter.tsx      — 乗換回数絞り込み
│   ├── CorrectionReporter.tsx  — 通勤時間訂正報告 UI
│   ├── CookieConsent.tsx       — Cookie 同意バナー
│   └── LoadingOverlay.tsx      — ローディング画面
├── i18n/                       — next-intl 設定
│   ├── routing.ts              — locales (ja / en / zh) / defaultLocale / localePrefix
│   ├── request.ts              — getRequestConfig
│   └── navigation.ts           — locale-aware Link / useRouter
├── proxy.ts                    — next-intl middleware（言語検出 + cookie）
├── messages/                   — i18n 翻訳ファイル
│   ├── ja.json                 — 日本語（デフォルト）
│   ├── en.json                 — English
│   └── zh.json                 — 中文
├── hooks/
│   ├── useDataLoaders.ts       — 静的データ fetch の集約（geojson / graph / 家賃 / EN 名等）
│   └── useBootstrap.ts         — localStorage からの状態復元（destination / AI cache）
├── lib/
│   ├── ai-recommend/           — AI 推薦 backend モジュール（7 ファイル）
│   ├── atoms/                  — Jotai atom 層（UI / data / domain / overlay 状態管理）
│   ├── dijkstra.ts             — client-side Dijkstra（カスタム目的地用）
│   ├── destinations.ts         — 30 fixed destination メタデータ（ja / en 表示名）
│   ├── station-label.ts        — 駅名の locale 別表示・検索マッチヘルパ（EN ローマ字対応）
│   ├── buckets.ts              — 通勤時間バケット + 配色
│   ├── affiliate.ts            — アフィリエイト link 生成（A8 wrap + fallback）
│   ├── area-features.ts        — 駅周辺特徴 loader（locale-aware）
│   ├── manual-rent.ts          — SUUMO 101 駅家賃
│   ├── government-rent.ts      — 政府統計 1940 駅家賃
│   ├── supabase.ts             — Supabase クライアント
│   ├── site-info.ts            — 法務ページ運営者情報 facade
│   ├── storage-keys.ts         — localStorage / sessionStorage キー SSOT
│   ├── constants.ts            — 定数 SSOT
│   ├── types/                  — 共有型定義
│   └── ...                     — device-id / line-styles / yahoo-url / useIsMobile 等
├── public/data/
│   ├── stations.geojson        — 1831 駅 + 30 destinations 通勤時間（スクリプト生成物）
│   ├── graph.json              — 隣接グラフ（スクリプト生成物）
│   ├── area_features.json      — 駅周辺特徴（日本語）
│   ├── area_features_zh.json   — 駅周辺特徴（中文）
│   ├── station_names_en.json   — 駅名ローマ字マップ（スクリプト生成物）
│   ├── line_names_en.json      — 路線名英語マップ（スクリプト生成物）
│   ├── destinations_v2/        — 30 駅 SEO ランディングページ用長文 JSON
│   ├── suumo_stations.json     — SUUMO 駅 deep link マップ
│   ├── manual_rent_data.json   — SUUMO 101 駅家賃データ
│   ├── station_government_rent.json — 政府統計 1940 駅家賃
│   ├── station_entrances.json  — OSM 駅出入口座標
│   ├── line_styles.json        — 路線色 / シンボル
│   ├── congestion.json         — 路線混雑率
│   └── ...
├── scripts/
│   ├── build_stations_geojson_v3.py  — GTFS 通勤時間 + graph.json 生成
│   ├── build_suumo_station_map.py    — SUUMO 駅 deep link クロール
│   ├── generate_area_features.py     — 周辺特徴 batch 生成
│   ├── generate_station_names_en.py  — 駅名・路線名ローマ字生成 + geojson 注入
│   ├── build_station_government_rent.py — 政府家賃データ生成
│   └── ...                           — diagnose / lookup / merge 等
└── docs/
    ├── todo.md                 — 残タスク備忘録
    ├── brand.md                — ブランドスペック
    ├── rent-data-plan.md       — 家賃データ設計
    ├── affiliate-setup.md      — アフィリエイト導入ランブック
    ├── affiliate-compliance.md — アフィリエイト合規チェックリスト
    └── adr/                    — Architecture Decision Records
```

---

## デプロイ

`main` への push で Vercel に自動デプロイ。環境変数は Vercel Dashboard → Settings → Environment Variables で設定。

---

## データ著作権

| データソース | 用途 | ライセンス |
|---|---|---|
| [Seo-4d696b75/station_database](https://github.com/Seo-4d696b75/station_database) | 駅座標・隣接関係 | CC BY 4.0 |
| [TrainGTFSGenerator](https://github.com/fksms/TrainGTFSGenerator) | 各社時刻表 GTFS | 各事業者の公開条件に準拠 |
| 総務省統計局「住宅・土地統計調査」令和 5 年 | 市区町村別家賃 | 政府統計データ |
| 国土交通省「都市鉄道の混雑率」2023 年度版 | 路線混雑率 | 国土交通省データ |
| [OpenFreeMap](https://openfreemap.org/) / OpenStreetMap | 地図タイル + 駅出入口座標 | ODbL |
| OpenAI (gpt-5.4-nano) | AI 駅推薦 + 周辺特徴テキスト生成 | OpenAI Terms of Use |

---

## License

**コード**: [GNU AGPL-3.0-or-later](./LICENSE)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

本プロジェクトのソースコードは GNU Affero General Public License v3.0 で配布されます。
ネットワーク経由で改変版を提供する場合も、改変箇所を含む完全なソースコードの公開が義務付けられます。

**データ**: 各ソースの著作権は上記「データ著作権」セクションを参照。データソースは AGPL の対象外です。

**商業的利用・帰属表記**: [`NOTICE`](./NOTICE) ファイルを参照。
