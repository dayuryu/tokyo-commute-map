# AI 助手による駅推薦機能 — 設計計画 + v1 上線記録

> 主人が 2026-05-12 夜に提示した次フェーズの目玉機能。
> 「AI が質問する → ユーザが選ぶ → AI が 20 駅 + 理由を返す」というフロー。
> 本ドキュメントは設計仕様 + v1 実装結果のスナップショット。

最終整理日: 2026-05-13（**v1 上線**）

---

## 📍 v1 ステータス（2026-05-13）

**全 Phase 上線完了**。production URL: https://tokyo-commute-map.vercel.app/

実装ファイル:
- Backend: `app/api/recommend/route.ts` + `lib/ai-recommend/*`
- UI: `components/AiWizard.tsx`, `AiResultGrid.tsx`, `AiRecallButton.tsx`
- 統合: `app/page.tsx`, `components/StationDrawer.tsx`, `components/DestinationAsk.tsx`, `components/MapView.tsx`
- データ: `public/data/area_features.json`

設計と実装の差分:
- Phase 5「地図 highlight」は**選択中 1 駅のみ**実装（黒ピン + 散点 hide）。
  20 駅一括 highlight は v2 候補に繰延（`todo.md` 参照）。
- Phase 7「rate limit」は当初 5/day だったが主人方針で 1/day に厳格化。
  cache 命中は無制限（recall できる UX）。
- 6 問目「外せない条件 (自由記述)」は採用せず、5 問 + destination = 6 問構成。

### 2026-05-13 (PM) v1 上線後の微調・bug 修正

UI/UX 整理 session で AI 動線に関する以下の改善を実施:

- **AiRecallButton 双 mode 化**: aiCache=null 時は「AI に聞いてみる」初回 CTA、
  存在時は従来の「20 駅を再表示」。地図上常駐で、DestinationAsk で AI を
  選ばずに地図に来た user の後追い起動を担保（死路 UX 解消）。
- **AiWizard 退出 CTA 追加**: 通勤先選択画面（30 駅起点）に
  「← ご希望の駅が見つからない方は、地図へ戻る」+「対応駅は順次追加」を配置。
  対応駅外の user を死路に感じさせない設計。
- **handleWizardResolve 体感速度改善**: AiWizard 内部の 700ms closing fade と
  page.tsx 側の 900ms WELCOME_FADE_MS が直列で 1.6s 待たされていた問題を修正。
  900ms 側を削除し、wizard fade ほぼ完了と同時に flyTo + drawer slide 開始。
- **MapView destInfo lookup 括弧後缀対応**: geojson の駅名に同名衝突回避の
  括弧後缀（田町(東京) / 大手町(東京) / 神田(東京) / 大宮(埼玉) /
  押上（スカイツリー前））が付与されている 5 駅で、これらを destination に
  選ぶと赤ピンが描画されない bug を修正（精確 match → 括弧 prefix 前缀 fallback）。
- **MapView 選択駅 flyTo 確実化**: 旧実装は inView 時 skip していたが、
  抽屉 380px に隠れた station / destination flyTo 直後の bounds 中央付近で
  見えにくいケースを取りこぼしていた。選択駅変更時は常に flyTo するように変更、
  桌面端は offset:[-190, 0] で抽屉左側 viewport の視覚中心に配置。
- **StationDrawer 抽屉打開時の地図交互**: absolute inset-0 z-20 の全幅 backdrop
  が地図 pan/zoom/cluster click を阻害していた bug を修正。backdrop を削除し、
  抽屉打開中も地図を操作可能に。閉じる手段は右上 × / モバイル swipe /
  ブラウザ戻る 3 系統で担保。
- **ChatGPT brand 表記追加**: OpenAI brand guideline に従いロゴ不使用、文字表記のみで
  StationDrawer の AI 要約 disclaimer / DestinationAsk の AI hero card /
  AiResultGrid の brand attribution「Powered by OpenAI」3 箇所に明示。

---

---

## 主人が提示した仕様

```
AI 問 5〜8 個の選択肢式質問
   ↓
ユーザがクリックで回答
   ↓
AI が 20 駅を推薦
   ↓
各駅に 1〜2 文の推薦理由
```

技術要件:
- **JSON Schema (structured outputs)** で出力を制約し、安定して 20 駅 list を取得
- このサイトの**売り**の一つとして AI 推薦を訴求

---

## 明日着手前に主人が決定すべき項目

### 1. AI プロバイダ選択

| 候補 | 強み | 月コスト目安 |
|---|---|---|
| **Claude (Anthropic)** | tool_use / JSON 出力 が安定。日本語品質高 | $0.02-0.05/推薦 |
| **OpenAI GPT-4o-mini** | structured outputs 公式対応、安価 | **$0.003-0.01/推薦** |
| **Google Gemini Flash** | 無料 tier 大きい（月 50 万 token） | 無料 〜 ¥少額 |

→ **本小姐の推奨**: GPT-4o-mini（コスト最良 + structured outputs 公式サポート）。
   ただし主人が既に Anthropic / Google の API key を持っていれば優先。

### 2. API 呼び出しアーキテクチャ

- ❌ client → AI 直接（API key が露出）
- ✅ **client → Next.js Route Handler (`app/api/recommend/route.ts`) → AI**
- 代替: client → Supabase Edge Function → AI（既存 backend 流用）

→ 本小姐推奨: Next.js Route Handler。Supabase Edge Function は Deno で
   AI SDK が制限的なため。

### 3. 質問項目（5〜8 個）の設計案

| # | 質問 | 選択肢例 |
|---|---|---|
| 1 | 通勤先は？ | 30 駅 quick CTA を再利用 |
| 2 | 通勤時間の上限は？ | 30 分 / 45 分 / 60 分 / 90 分 |
| 3 | 家賃の上限は？ | 〜7 万 / 7-10 万 / 10-15 万 / 15 万+ |
| 4 | 家族構成は？ | 単身 / カップル / 子持ち |
| 5 | 街の雰囲気は？ | 賑やか / 落ち着いた / 緑が多い / 商業集中 |
| 6 | 治安はどれくらい重視？ | 最重要 / 普通 / 気にしない |
| 7 | 駅前か少し離れていいか？ | 駅近 必須 / 徒歩 10 分 OK / 関係ない |
| 8 | （オプション）外せない条件は？ | 自由記述 or skip |

→ 5〜8 のいずれにするかは Q4-Q8 をどこまで入れるかで決まる。
   本小姐の prior: **6 問**（Q1-Q6）が onboarding 速度と推薦精度のバランス良い。

### 4. JSON Schema の構造

```json
{
  "type": "object",
  "properties": {
    "recommendations": {
      "type": "array",
      "minItems": 20,
      "maxItems": 20,
      "items": {
        "type": "object",
        "properties": {
          "station_name": { "type": "string" },
          "reason": { "type": "string", "maxLength": 120 }
        },
        "required": ["station_name", "reason"]
      }
    }
  },
  "required": ["recommendations"]
}
```

→ ただし AI が架空の駅名を吐き出すリスクあり。
   **mitigation**: prompt に 1843 駅の name list を context として渡し、
   その中から選ばせる + 後段で valid な駅名のみ filter。
   token 量を抑えるため station_database から駅名だけ抜く（lat/lng 不要）。

### 5. UI / 統合方針

主な検討点:
- 推薦 20 駅を**地図上で highlight** する？それとも別 overlay の list？
- 既存の DestinationAsk 流れとどう繋ぐ？
  - 案 A: DestinationAsk に「AI に相談する →」ボタン追加 → AI ウィザード起動
  - 案 B: HelpButton 隣に「AI 推薦」専用ボタン追加
  - 案 C: トップに新しい entry「AI に聞く」を Welcome の選択肢に追加
- 推薦理由（1-2 文）の表示位置: 地図上 popup / drawer / 別 list

→ 本小姐 prior: **案 A** (DestinationAsk から自然に分岐)。
   UI は editorial 風で章立て scrolly に近い体験にする。

### 6. コスト・速度・失敗処理

- **rate limit**: device_id ベースで 1 日 5 回まで（Supabase RLS で実装可）
- **キャッシュ**: 同じ 6 問答えなら同じ推薦を返す（hash of answers → result）
  - Supabase に `ai_recommendations` 表を作って永続化
- **JSON Schema 違反時**: 1 回 retry、それでもダメなら fallback（30 個 fixed の上位 20）
- **タイムアウト**: 30 秒、それを超えたら fallback

### 7. 売りとしての訴求方法

- README に「AI が住む街を提案」を 1 行追加
- Welcome / Story / DestinationAsk のどこかで「AI 推薦」を露出
  - 本小姐推奨: DestinationAsk 下部に小さく「AI に提案してもらう →」
- 法的注記: AI 推薦は補助情報、最終判断はユーザ（/legal/ads と類似）

---

## 想定工程（粗見積もり） + 実績

| Phase | 内容 | 想定工時 | 実績 (2026-05-13) |
|---|---|---|---|
| 0 | 主人による API key 取得 + provider 確定 | 主人 30min | ✅ OpenAI gpt-5.4-nano |
| 1 | `.env.local` に AI API key 追加 | 5min | ✅ |
| 2 | `app/api/recommend/route.ts` 実装 | 2h | ✅ 前 session |
| 3 | JSON Schema + prompt template 確定 | 1.5h | ✅ 前 session |
| 4 | AI Wizard UI コンポーネント実装 | 3-4h | ✅ 本 session |
| 5 | 推薦結果の地図 highlight + drawer 統合 | 2h | △ 部分（選択 1 駅のみ）。20 駅一括 highlight は v2 |
| 6 | Supabase `ai_recommendations` 表 + キャッシュ実装 | 1.5h | ✅ 前 session + 本 session で localStorage 24h cache 追加 |
| 7 | rate limit + 失敗処理 | 1h | ✅ 1/day 厳格化 |
| 8 | editorial UI 整形 + 法的注記 | 1.5h | ✅ |

実績合計 **約 8h**（本 session）+ 前 session 約 5h = 約 13h。設計工時とほぼ一致。

---

## 明日のスタート手順

主人が朝起きたら:

1. **AI provider 決定**（GPT-4o-mini を推奨）
2. **OpenAI / Anthropic / Google で API key 発行**
3. `.env.local` に追加（例 `OPENAI_API_KEY=sk-...`）
4. 本小姐に「**provider X 決まった、API key 入れた**」と伝える
5. 本小姐が Phase 2 から着手

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-12 | 主人提示の AI 駅推薦機能の仕様を整理。明日着手前の決定事項 7 項目を列挙 |
| 2026-05-13 | v1 上線。Phase 2,3,6,7 (前 session) + Phase 4,8 + 24h cache + recall + 1/day rate-limit (本 session)。Phase 5 完全版 (20 駅一括 highlight) は v2 候補に繰延 |
