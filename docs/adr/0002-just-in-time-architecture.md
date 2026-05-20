# 0002. Just-In-Time Architecture を採用、Airbnb-tier の基建を見送り

**Status:** Accepted
**Date:** 2026-05-21

## Context

2026-05-21 のセッションで、プロジェクトオーナーから「長期可維護性を向上させたい」
「真正の複雑な商業 site の基礎建設を導入したい」「5 年後に屎山にしたくない」
との要望が提示された。

現状の負債：

- `app/[locale]/page.tsx` 765 行の god component（state + handler + render が
  一箇所に集中）
- 文案 hardcoded（i18n で解消中、残 ~200 箇所）
- `storage key` 散在 + 重複定義（解消済 → `lib/storage-keys.ts`）
- 跨ファイル型が `page.tsx` から逆向き export（解消済 → `lib/types/`）
- inline `color: '#xxx'` / `fontSize: nn` 散在
- ADR / 設計判断の言語化が無く、「なぜそうなっているか」が口承

要望スコープの解釈幅：
- A. 「Airbnb / Notion 級」フル基建（monorepo + microfrontend + design token
  pipeline + 自動テスト + Storybook + CI/CD pipeline + DDD）
- B. 「中型商業 site」基建（Zustand + zod + Storybook + 部分テスト）
- C. 「小型商業 site」基建（SSOT 層 + 単方向 import + ADR + Just-In-Time refactor）
- D. 現状維持（i18n だけ進める、底座は触らない）

## Decision

**C「小型商業 site」基建 + Just-In-Time Architecture** を採用。

具体的に：

1. **「防屎山骨架」(SSOT 層) は先行整備する**（A 清单）：
   - `lib/storage-keys.ts`（完成）
   - `lib/types/`（完成）
   - `lib/constants.ts`（完成）
   - `docs/adr/`（本 ADR が一例）
   - `CLAUDE.md` 更新

2. **「Just-In-Time refactor」は新機能と同 PR で実施**（B 清单）：
   - `lib/api/{supabase,openai}/` 集中 + zod schema 校验
   - `lib/hooks/` で `page.tsx` を 5 個の custom hook に分解
   - `components/` を feature 別目錄に再編
   - `WelcomeOverlay` の 3 動画ロジックを hook 抽出

3. **「将来需要があれば」のレイヤーは現時点で作らない**（C 清单）：
   - ❌ Zustand / Jotai（`useState` + props lift で当面足りる）
   - ❌ Design token 系統化（CSS var で十分、inline color 撲滅は過剰）
   - ❌ Storybook（1 人プロジェクトの ROI 低い）
   - ❌ 自動テスト framework（主人による手動 verify が現状の最適コスパ）

4. **「これは導入しない」レイヤー**（D 清单）：
   - ❌ Monorepo / Microfrontend
   - ❌ DDD 重型適用
   - ❌ 自前 framework wrapper

## Why

### A 案（Airbnb-tier）を選ばなかった理由

複雑な基建が必要な前提条件が揃っていない：

| 前提条件 | Airbnb 等 | 本プロジェクト |
|---|---|---|
| エンジニア数 | 10-200 人並行 | 1 人（主人） |
| Deploy target | 5+（web/iOS/Android/TV/Watch） | 1（web） |
| Business domain | 5+（payment/auth/messaging/search...） | 1（地図 + 推薦） |
| 規制要件 | 厳格 compliance（金融/医療） | 一般商業 |
| 路由数 | 100+ | ~10 |

これらの条件が無い段階で大手 tier 基建を導入すると：
- **迭代速度が落ちる** → プロジェクトの停滞 → 主人のモチベーション低下 → 反屎山戦略が反って屎山を産む
- **抽象が想像で設計される** → 半年後 fit しない → さらに refactor 必要 → 結局二度手間
- **「半年底座作って 0 機能リリース」** の死亡螺旋

### Just-In-Time Architecture を選んだ理由

ソフトウェア工学の経験則：
> 良い抽象は「**設計する**」ものではなく「**抽出する**」もの。

具体的 use case の駆動が無い抽象設計は YAGNI (You Aren't Gonna Need It) 反
パターンに陥りやすい。代わりに：

1. 新機能を作る度に「既存抽象で支えられるか」を 3 秒考える
2. 支えられない → 抽象升級と機能実装を**同じ PR で**やる（use case 駆動 =
   抽象が正確になる）
3. 支えられる → 機能だけ作る
4. 毎月最終日に 30 分 review で tech debt を backlog 化

### 5 大反屎山原則

A 清单で建てた SSOT 層と、Just-In-Time refactor の判断軸として以下を採用：

1. **Single Source of Truth** — 1 つの事実は 1 箇所だけ
2. **Content vs Presentation 分離** — 文案/設計 token/ロジックは別レイヤー
3. **Domain Layering** — `app/ → components/ → lib/ → data/` 単向依存
4. **Type-Driven Boundaries** — 跨ファイル境界に型 + zod 等の runtime 校验
5. **Convention over Configuration but Documented** — 決定は ADR に書く

## Trade-offs

1. **「最終形」の安心感が無い**：永遠に途中。基建を 1 度完璧に組んで安心、は
   この方針では訪れない。
2. **規律が必要**：毎月 review + 機能 PR で抽象 inspect を怠ると、Just-In-Time
   が「Never」になり負債が累積する。
3. **数値目標が立てづらい**：「コードカバレッジ 80%」のような明示目標が無い
   ため、主観で「健康」「不健康」を判断する必要がある。
4. **新メンバー onboarding 時の説明コスト**：ADR を読み込ませる必要があり、
   読まなければ「なんで設計されてないの」「設計が雑」と誤解されるリスク。
   → 本 ADR + memory `project_maintenance_strategy.md` で対策。
5. **「将来やる」リスト（B 清单）が膨らみすぎる可能性**：トリガー無しで自動的
   に消化されないため、定期 review でこまめに優先度判断する必要。

## When to revisit

以下のいずれかが満たされたら、本 ADR を超える基建 tier への移行を検討：

- **チーム拡張**：開発者が 3 人以上になった時
- **第二 deploy target**：PWA / mobile native / 別プロダクト等が出現
- **複数 business domain**：通勤地図以外の機能 (payment / 認証 / messaging
  等) が中核化
- **訪問量 100K MAU 超**：scale 要件で必要な抽象（caching layer / queue 等）
  が増える
- **法規制変化**：個人情報保護法 / GDPR 違反リスクで監査 trail が必須化
- **主人の事業方針転換**：単独運営から複数人 / 受注開発 等への変更

revisit 時のフレームワーク：
1. 現在の C 清单 / D 清单のどの項目が「やる」に格上げか？
2. 既存 A 清单 / B 清单のうち、再設計が必要なものは？
3. 移行コスト見積もり vs 期待利益、ROI が positive な項目から順次。

## 関連
- 全体戦略の memory: `~/.claude/projects/F--supermap/memory/project_maintenance_strategy.md`
- 落地清单: [`../todo.md`](../todo.md) の「🏗️ 基礎工程」
- i18n 採用判断: [`./0001-i18n-next-intl.md`](./0001-i18n-next-intl.md)
