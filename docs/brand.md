# Kayoha — ブランドスペック (v1, 2026-05-15 定稿)

> 通勤マップから生まれた「住む街を選ぶ」ための editorial 地図メディア。
> 二層構造のブランド: ローマ字メインブランド Kayoha + 漢字シンボルマーク 通葉。

---

## 1. ブランドアイデンティティ

### 1.1 メインブランド + シンボルマーク

| レイヤー | 名称 | 用途 | フォント |
|---|---|---|---|
| **メインブランド** | **`Kayoha`** (ローマ字) | 広報 / SEO / ASP 申込 / 多言語 / 海外 — すべての**対外接点** | Cormorant Garamond Light |
| **シンボルマーク** | **`通葉`** (漢字、繁体字保持) | ロゴ副位 / favicon / 印章 / OG image / 紙媒体 — すべての**視覚強調位置** | Shippori Mincho SemiBold |

### 1.2 タグライン

- **日本語主版** (確定): **`次の駅で、暮らしをめくる。`**
- 中国語版 / 英語版: Phase 6 以降に検討
  - 候補例: `下一站、翻开生活` / `Turn the page, one station at a time.`

### 1.3 命名由来

- `Kayoha` = `通` (kayou) + `葉` (ha)
- `通` = 通う / 行き来 / 通る
- `葉` = 一葉 / 書簡 / ページ
- `めくる` (頁を捲る動作) が「葉 / 頁」と意味的に強く結びつくため、二層ブランドのナラティブが self-consistent になる
- 中国語圏のユーザーは `通叶 (tōng yè)` と読むが、**繁体字字形は変更不可**

### 1.4 ドメイン + 既取得資産

| ドメイン | レジストラ | 用途 | 期限 |
|---|---|---|---|
| **kayoha.com** (主域) | Cloudflare Registrar | グローバル / 多言語 / ASP / canonical | 2027-05-14 |
| kayoha.jp | Onamae.com | 日本 SEO 防御 / 301 → kayoha.com | 2027-05-31 |

---

## 2. デザインシステム (既存、変更不可)

### 2.1 フォント

| 用途 | フォント | Weight | CSS variable |
|---|---|---|---|
| **Kayoha ローマ字** | **Cormorant Garamond** | 400-500 (Light) | `var(--display-italic)` |
| **通葉 漢字** | **Shippori Mincho** | 600-700 (SemiBold〜Bold) | `var(--display-font)` |
| UI / body text | Inter | 400-700 | `var(--ui-font)` |
| 数値 / monospace | JetBrains Mono | 400-500 | `var(--mono)` |

全て Google Fonts、`app/layout.tsx` 内の `next/font/google` で読み込み済み。

### 2.2 カラーパレット (Springs editorial palette、`app/globals.css`)

#### 地図系 (Springs map palette)

```
--sp-bg        #ece4d2  cream paper
--sp-park      #b9c094  sage
--sp-river     #9ab2c0  slate-blue water
--sp-road      #d4c8af  hairline tan
--sp-ink       #2d3a26  deep olive ink
--sp-ink-soft  #5b6b4f
--sp-txt       #3a3a30  body
--sp-txt-soft  #7a7868
```

#### Editorial chrome 系 (drawer / overlay / control bar)

```
--bg           #f4f1ea  paper background
--land         #ebe6db
--water        #d8d3c4
--park         #d2dcc6
--ink          #1f1d18  primary ink
--ink-soft     #5b574c  secondary
--ink-mute     #908a7c  caption
--accent       #14365b  navy (極小用)
--pin          #a8332b  red-brick (通葉 字 + 重点強調用)
```

### 2.3 デザイン DNA

- **Editorial 雑誌感** (参考: Apartamento Magazine / Brutus Casa / 暮しの手帖)
- **抑制 + 余白** (情報密度は低く、余白を多く)
- **明朝体 + クラシック英文 serif + 数値 mono の混排** (sans-serif を主見出しに使わない)
- **紙質感 / 印刷物の質感** (背景 cream / paper 系、純白は避ける)

---

## 3. 二層ブランドの適用ルール

### 3.1 Kayoha ローマ字主 + 通葉 漢字副 (二層ロゴ)

適用: Header ロゴ / Welcome 画面 / Loading 画面 / Hero エリア / 名刺 / 紙印刷物

**現状の React 実装** (`components/WelcomeOverlay.tsx` line 340-368、`components/LoadingOverlay.tsx` line 88-114):

```tsx
<div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
  <span style={{
    fontFamily: 'var(--font-cormorant), serif',
    fontSize: 24,           // Welcome desktop
    fontWeight: 400,
    letterSpacing: '.06em',
  }}>Kayoha</span>
  <span style={{
    fontFamily: 'var(--font-shippori), serif',
    fontSize: 11,
    fontWeight: 600,
    color: '#a8332b',       // pin red
    letterSpacing: '.3em',
    marginTop: 2,
  }}>通葉</span>
</div>
```

### 3.2 Kayoha ローマ字のみ

- `<title>` / OG title / 法務ページ site name / ASP 申込書 / メール署名 / Twitter handle など
- コピーテンプレート: `Kayoha — 次の駅で、暮らしをめくる。`

### 3.3 通葉 漢字シンボルのみ (独占使用)

- **favicon** (16 / 32 / 64 / Apple Touch Icon 180)
- **OG image 装飾** (切手 / 印章風 corner mark)
- **Loading 転場点綴**
- **紙ベース判子** (名刺角 / 信箋装飾)

---

## 4. Phase 6 ビジュアルアセット wishlist (Claude Design 出 → Claude Code 実装)

### 4.1 必須 (high priority)

- [ ] **favicon set** (16 / 32 / 64 / 180 ICO + SVG)
  - 方向 A: **通葉** 二字印章 (最優先、editorial 雅度最高)
  - 方向 B: **通** 一字判子 (朱印風)
  - 方向 C: **葉** 一字判子 (葉脈モチーフも可)
  - 方向 D: 抽象図形 (葉 / 通 / 頁 モチーフ、modern interpretation)
  - 各方向 3〜5 候補を並列出力し比較

- [ ] **OG image** (1200 × 630)
  - 主版式: 大字 Kayoha + 副字 通葉 + tagline + 地図ミニカット corner
  - 副版式: 通葉 切手風 + 余白 + 駅名 list
  - 多言語版 (中国語 / 英語) — 後日対応

### 4.2 推奨 (mid priority)

- [ ] **ロゴ treatment refinement**
  - 現状の二層ロゴは「文字版」、Phase 6 で以下を探索:
    - 切手風 wrapper (通葉 + 切手縁歯 + 角章)
    - 判子風 (朱印 + 文字陰刻)
    - ローマ字 italic 花体変種 (Cormorant Italic 強調)
  - Header / Hero / Splash 各シーンへの適用版

- [ ] **Story / Welcome の版式**
  - 現状は 3 章物語 + 単 hero
  - 探索: 雑誌 spread 見開き風 / Issue No. 1 編集物 typography / 章扉

### 4.3 オプション (low priority、将来)

- [ ] **カラーリフレッシュ案**
  - Springs palette の現状が Kayoha ブランドに合うか
  - `--pin: #a8332b` の赤 accent をより柔和な色 (朱 #c75b39 / 墨 #2c2a2a など) に変更するか
  - **大改は禁、最大でも accent の微調整に留める**

- [ ] **印刷物テンプレート** (遠期)
  - 名刺 / Issue No. ?? コンセプトブック / 駅舎ステッカー

---

## 5. 不可侵の制約 (Claude Design は必ず遵守すること)

### ✅ 固定不変

- メインブランド名 **`Kayoha`** (綴り・大文字小文字・Cormorant Garamond)
- シンボルマーク **`通葉`** (**繁体字**、Shippori Mincho、簡体字「通叶」は不可)
- タグライン **`次の駅で、暮らしをめくる。`** (中点 + 句点を含む、句読点の改変不可)
- フォント組み合わせ (Cormorant Garamond + Shippori Mincho)

### ❌ 禁止

- フォントを sans-serif 主体へ変更すること
- 通葉 を簡体字「通叶」に簡略化すること (漢字字形の美しさを破壊する)
- Springs palette を全置換すること (最大でも accent の微調整まで)
- 製品の対外コピーに「東京圏通勤マップ」「Tokyo Commute Map」旧名を出すこと
- 赤 accent `#a8332b` を蛍光彩度カラーへ変更すること

---

## 6. 完了済みの Phase 5 改名実装 (2026-05-15 deploy)

コード層の改名を一括コミット `4612129` (12 files):

- `lib/site-info.ts`: siteName / siteNameJa / siteUrl
- `app/layout.tsx`: metadata + openGraph
- `components/WelcomeOverlay.tsx` + `LoadingOverlay.tsx`: 二層ロゴ
- `app/legal/*` 5 ページ: metadata + body
- `README.md` / `NOTICE` / `package.json`

ドメイン + DNS + Vercel 接続完了 (詳細は `~/.claude/projects/F--supermap/memory/project_brand_kayoha.md` 参照)。

**Phase 6 ビジュアルアセット**: 主人が Claude Design で設計 → handoff bundle → Claude Code で codebase に実装する流れ。

---

## Changelog

| 日付 | 内容 |
|---|---|
| 2026-05-15 | v1 確定 (改名当日 + Kayoha 三ドメイン稼働日 + コード改名 deploy 同日) |
