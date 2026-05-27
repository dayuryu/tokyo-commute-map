# Kayoha (通葉)

> 次の駅で、暮らしをめくる。 — 通勤時間で東京圏の駅を可視化する地図。

**Live**: https://kayoha.com/

通勤時間ベースで「どこに住むか」を直感的に決められる地図ツールです。
東京圏 1843 駅を通勤所要時間で色分けし、駅をクリックすると通勤詳細・AI 推薦・家賃目安・周辺の特徴・コミュニティ評価・物件検索リンクが表示されます。
日本語・英語・中国語の 3 言語対応。

---

## 特長

- 🗺️ **等時圏マップ** — 30 の主要目的地 + 任意のカスタム目的地への通勤時間で駅を 6 段階にカラーリング
- 📊 **GTFS 真実時刻表** — 22 運営事業者の公開時刻表データから算出（rush-hour プールメディアン方式）
- 🤖 **AI おすすめ** — OpenAI 搭載のウィザードで、予算・通勤時間・ライフスタイルから最適な駅を提案
- 🏠 **家賃データ** — 国土交通省の公式統計 + 手動補完データで駅ごとの家賃目安を表示
- 🏘️ **エリア特徴** — 全 1843 駅の周辺環境・雰囲気を AI 生成テキストで紹介
- 👥 **コミュニティ評価** — 物価・治安・電車混雑の 10 点スコア投稿 + 通勤時間訂正報告
- 🔗 **物件検索連携** — SUUMO 賃貸の駅単位 deep link で迅速な物件探しへ
- 🌐 **多言語 (i18n)** — 日本語 / English / 中文 の 3 言語対応（next-intl）
- 📄 **目的地ページ** — 30 駅の長文 SEO/AEO コンテンツ + FAQ 構造化データ
- 📱 **モバイル最適化** — viewport 制御 + responsive layout + タッチ操作対応

---

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| i18n | next-intl（`[locale]` ルーティング / ja・en・zh） |
| Styling | Tailwind CSS v4 + Springs editorial palette |
| Map | MapLibre GL JS + OpenFreeMap liberty style |
| AI | OpenAI API + react-markdown |
| Backend | Supabase (PostgreSQL + Row-Level Security) |
| Analytics | Vercel Analytics |
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

# 任意 — OpenAI（AI おすすめ機能）
OPENAI_API_KEY=

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

> アフィリエイト系・運営者情報系は未設定でもアプリは動作します。
> OPENAI_API_KEY 未設定時は AI おすすめ機能が無効になります。

---

## データ生成スクリプト

### 駅 + 通勤時間データ — `stations.geojson`

GTFS 公開時刻表からの本格的な通勤時間計算（rush-hour プールメディアン）。

```bash
# 前提: ../station_database リポジトリが必要（CC BY 4.0）
# gtfs_cache/ は初回実行時に自動ダウンロード（22 事業者 / 数百MB）
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_stations_geojson_v3.py \
  ../station_database ./gtfs_cache
```

出力: `public/data/stations.geojson` (1843 駅 / ~3.6 MB)

### SUUMO 駅 deep link — `suumo_stations.json`

SUUMO 賃貸の沿線ページから駅単位の `ek_<id>?rn=<rn>` URL を抽出。

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_suumo_station_map.py
```

出力: `public/data/suumo_stations.json`

> SUUMO サーバへの配慮として 1.2 秒間隔のスリープ付きクロール。所要時間 5〜10 分程度。

### その他のデータ生成

| スクリプト | 出力 | 説明 |
|---|---|---|
| `build_government_rent_data.py` | `government_rent_data.json` | e-Stat 国土交通省の公式家賃統計 |
| `build_station_government_rent.py` | `station_government_rent.json` | 駅 ↔ 家賃データの紐付け |
| `build_station_pref.py` | `station_pref.json` | 駅 ↔ 都道府県マッピング |
| `build_station_entrances.py` | `station_entrances.json` | OSM 駅出入口座標 |
| `build_line_styles.py` | `line_styles.json` | 路線カラー・スタイル |
| `generate_area_features.py` | `area_features.json` | AI 生成エリア特徴テキスト |
| `generate_destination_descriptions.py` | `destination_descriptions.json` | 目的地ページ用の説明文 |
| `lookup_destinations.py` | `destinations_v2/*.json` | 30 目的地の事前計算通勤データ |

---

## ディレクトリ構成

```
tokyo-commute-map/
├── app/
│   ├── layout.tsx                — ルートレイアウト
│   ├── globals.css               — Springs editorial palette tokens
│   ├── robots.ts / sitemap.ts    — SEO
│   ├── api/recommend/            — AI おすすめ API ルート
│   └── [locale]/                 — i18n ルーティング (ja/en/zh)
│       ├── page.tsx              — メインマップページ
│       ├── layout.tsx
│       ├── to/[slug]/            — 30 目的地の長文 SEO ページ
│       └── legal/                — 法務 5 ページ (privacy / ads / commerce / contact / credits)
├── components/
│   ├── MapView.tsx               — MapLibre 地図 + 駅レイヤー
│   ├── StationDrawer.tsx         — 駅クリック時のドロワー（通勤詳細 + 評価 + 物件検索）
│   ├── AiWizard.tsx              — AI おすすめウィザード
│   ├── AiResultGrid.tsx          — AI 結果カード表示
│   ├── AiRecallButton.tsx        — AI 結果の再表示ボタン
│   ├── WelcomeOverlay.tsx        — オンボーディング 1 段目
│   ├── Story.tsx                 — オンボーディング 2 段目
│   ├── DestinationPicker.tsx     — 目的地選択
│   ├── DestinationAsk.tsx        — 目的地選択プロンプト
│   ├── TimeSlider.tsx            — 通勤時間絞り込み (15〜90 分)
│   ├── TransferFilter.tsx        — 乗換回数絞り込み
│   ├── CorrectionReporter.tsx    — 通勤時間訂正報告 UI
│   ├── Legend.tsx                — 凡例
│   ├── HeaderMenu.tsx            — ヘッダーメニュー
│   ├── LoadingOverlay.tsx        — 読み込み中オーバーレイ
│   └── CookieConsent.tsx         — Cookie 同意バナー
├── lib/
│   ├── ai-recommend/             — AI おすすめロジック（OpenAI / キャッシュ / レート制限）
│   ├── dijkstra.ts               — カスタム目的地用グラフ経路探索
│   ├── destinations.ts           — 事前計算済み目的地データ管理
│   ├── government-rent.ts        — 国土交通省家賃データ
│   ├── manual-rent.ts            — 手動補完家賃データ
│   ├── area-features.ts          — エリア特徴テキスト
│   ├── station-entrances.ts      — 駅出入口座標（Google Maps リンク用）
│   ├── line-styles.ts            — 路線カラー
│   ├── supabase.ts               — Supabase クライアント
│   ├── affiliate.ts              — アフィリエイト link 生成 facade
│   ├── yahoo-url.ts              — Yahoo! 不動産 URL 生成
│   ├── site-info.ts              — 法務ページ運営者情報 facade
│   ├── buckets.ts                — 通勤時間バケット定義
│   ├── constants.ts              — 定数
│   ├── device-id.ts              — 匿名デバイス ID 生成
│   ├── storage-keys.ts           — localStorage キー定義
│   ├── useIsMobile.ts            — モバイル判定フック
│   └── types/                    — TypeScript 型定義
├── i18n/                         — next-intl 設定 (routing / request / navigation)
├── messages/                     — 翻訳ファイル (ja.json / en.json / zh.json)
├── public/data/
│   ├── stations.geojson          — 通勤時間つき駅データ
│   ├── graph.json                — 駅グラフ（Dijkstra 用）
│   ├── destinations_v2/          — 30 目的地の事前計算通勤時間
│   ├── suumo_stations.json       — SUUMO 駅 deep link マップ
│   ├── congestion.json           — 路線混雑率（国土交通省データ）
│   ├── government_rent_data.json — 国土交通省家賃統計
│   ├── station_government_rent.json — 駅 ↔ 家賃紐付け
│   ├── manual_rent_data.json     — 手動補完家賃データ
│   ├── area_features.json        — エリア特徴 (ja)
│   ├── area_features_zh.json     — エリア特徴 (zh)
│   ├── destination_descriptions.json — 目的地ページ説明文
│   ├── station_entrances.json    — 駅出入口座標
│   ├── station_pref.json         — 駅 ↔ 都道府県
│   └── line_styles.json          — 路線カラー定義
├── scripts/                      — データ生成・診断スクリプト（上記参照）
└── docs/
    ├── adr/                      — Architecture Decision Records
    ├── affiliate-setup.md        — アフィリエイト導入ランブック
    ├── affiliate-compliance.md   — アフィリエイト法令遵守
    ├── brand.md                  — ブランドガイドライン
    ├── rent-data-plan.md         — 家賃データ計画
    └── todo.md                   — 開発 TODO
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
| 国土交通省「都市鉄道の混雑率」2023 年度版 | 路線混雑率 | 国土交通省データ |
| 国土交通省「不動産取引価格情報」(e-Stat) | 家賃統計 | 国土交通省データ |
| OpenStreetMap (Overpass API) | 駅出入口座標 | ODbL |
| [OpenFreeMap](https://openfreemap.org/) / OpenStreetMap | 地図タイル | ODbL |

---

## License

**コード**: [GNU AGPL-3.0-or-later](./LICENSE)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

本プロジェクトのソースコードは GNU Affero General Public License v3.0 で配布されます。
ネットワーク経由で改変版を提供する場合も、改変箇所を含む完全なソースコードの公開が義務付けられます。

**データ**: 各ソースの著作権は上記「データ著作権」セクションを参照。データソースは AGPL の対象外です。

**商業的利用・帰属表記**: [`NOTICE`](./NOTICE) ファイルを参照。
