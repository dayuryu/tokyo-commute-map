# Tokyo Commute Map (東京圏通勤マップ)

> 等時圏で探す、理想の住まい — 通勤時間で東京圏の駅を可視化する地図。

**Live**: https://tokyo-commute-map.vercel.app/

通勤時間ベースで「どこに住むか」を直感的に決められる地図ツールです。
東京圏 1,793 駅を通勤所要時間で色分けし、駅をクリックすると通勤詳細・コミュニティ評価・物件検索リンクが表示されます。

---

## 特長

- 🗺️ **等時圏マップ** — 新宿 / 渋谷 / 東京駅 + 任意のカスタム目的地への通勤時間で駅を 6 段階にカラーリング
- 📊 **GTFS 真実時刻表** — 22 運営事業者の公開時刻表データから算出（rush-hour プールメディアン方式）
- 👥 **コミュニティ評価** — 物価・治安・電車混雑の 10 点スコア投稿 + 通勤時間訂正報告
- 🏠 **物件検索連携** — SUUMO 賃貸の駅単位 deep link で迅速な物件探しへ
- 📱 **モバイル最適化** — viewport 制御 + responsive layout + タッチ操作対応

---

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + Springs editorial palette |
| Map | MapLibre GL JS + OpenFreeMap liberty style |
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
> アフィリエイト未設定時は各 ASP の通常 URL に遷移し、運営者情報は法務ページで安全な fallback が表示されます。

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

出力: `public/data/stations.geojson` (1,793 駅 / ~570 KB)

### SUUMO 駅 deep link — `suumo_stations.json`

SUUMO 賃貸の沿線ページから駅単位の `ek_<id>?rn=<rn>` URL を抽出。

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python scripts/build_suumo_station_map.py
```

出力: `public/data/suumo_stations.json` (1,576 駅 / ~325 KB)

> SUUMO サーバへの配慮として 1.2 秒間隔のスリープ付きクロール。所要時間 5〜10 分程度。

---

## ディレクトリ構成

```
tokyo-commute-map/
├── app/
│   ├── page.tsx              — メインマップページ
│   ├── layout.tsx
│   ├── globals.css           — Springs editorial palette tokens
│   └── legal/                — 特商法 / privacy / ads / contact 法務 4 ページ
├── components/
│   ├── MapView.tsx           — MapLibre 地図 + 駅レイヤー
│   ├── StationDrawer.tsx     — 駅クリック時のドロワー（通勤詳細 + 評価 + 物件検索）
│   ├── WelcomeOverlay.tsx    — オンボーディング 1 段目
│   ├── Story.tsx             — オンボーディング 2 段目
│   ├── DestinationPicker.tsx — 目的地選択（新宿/渋谷/東京駅/カスタム）
│   ├── TimeSlider.tsx        — 通勤時間絞り込み (15〜90 分)
│   ├── TransferFilter.tsx    — 乗換回数絞り込み
│   ├── CorrectionReporter.tsx— 通勤時間訂正報告 UI
│   ├── Legend.tsx            — 凡例
│   └── HelpButton.tsx
├── lib/
│   ├── supabase.ts           — Supabase クライアント
│   ├── affiliate.ts          — アフィリエイト link 生成 facade
│   ├── site-info.ts          — 法務ページ運営者情報 facade
│   ├── buckets.ts            — 通勤時間バケット定義
│   └── useIsMobile.ts
├── public/data/
│   ├── stations.geojson      — 通勤時間つき駅データ
│   ├── suumo_stations.json   — SUUMO 駅 deep link マップ
│   └── congestion.json       — 路線混雑率（国土交通省データ）
├── scripts/
│   ├── build_stations_geojson_v3.py    — 現行の GTFS 通勤時間計算
│   ├── build_stations_geojson_v2.py    — GTFS 計算 v2 (履歴)
│   ├── build_stations_geojson.py       — 距離推算版 v1 (履歴)
│   ├── build_suumo_station_map.py      — SUUMO 駅 deep link クロール
│   ├── diagnose_data_sources.py        — 精度診断ツール
│   └── check-mobile.mjs                — モバイル UI 検証スクリプト
└── docs/
    └── affiliate-setup.md    — アフィリエイト導入ランブック
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
| [OpenFreeMap](https://openfreemap.org/) / OpenStreetMap | 地図タイル | ODbL |

---

## License

MIT (コードのみ)。データソースの著作権は上記表を参照。
