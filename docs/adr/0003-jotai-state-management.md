# 0003. 状態管理を Jotai に全面移行（page.tsx の god component 解体）

**Status:** Accepted
**Date:** 2026-05-31

## Context

`app/[locale]/page.tsx` は 726 行の god component に肥大化していた：

- 25 個の `useState` + 2 個の `useMemo` + 9 個の data-loading `useEffect` + 十数個の handler が一箇所に集中
- 特に **`destination` と `customStation` の不変量**（`destination === 'custom'` ⟺ `customStation` 非 null）が、6 個の handler が `setDestination` + `setCustomStation` を手動でペア更新する「人的規律」だけで維持されていた
- このペア更新の漏れが実バグを生んだ：AI wizard を早期クローズすると通勤先が新宿に戻る（commit `1c9a8a1` で対症療法的に修正済だが、根因は構造的）
- 9 個の overlay フラグ（welcome / story / destinationAsk / wizard / loader 等）が `window.setTimeout(fn, OVERLAY_FADE_MS)` の瀑布鎖で暗黙に結合し、時序バグの温床になっていた

ADR-0002 では Zustand / Jotai を「C 清单（延後・当面やらない）」に分類していたが、上記の実バグは「想像上の未来需要」ではなく「現実の pain」であり、ADR-0002 の Just-In-Time 原則（現実の pain には直ちに対応）の発動条件を満たした。

## Decision

**Jotai を採用し、page.tsx の状態を全面的に atom 化する。**

設計の柱：

1. **三層 Domain Layering で atom を組織**（`lib/atoms/` 配下）
   - 核心領域層（`domain.ts`）/ UI 叶子（`ui.ts`）/ データ加載層（`data.ts` / `area-features.ts`）/ 永続化（`ai-cache.ts`）/ 派生（`derived.ts`）/ UI 編成（`overlay.ts`）

2. **不変量を「構造上表現不可能」にする**（最重要）
   - `commuteTargetAtom`（`{destination, customStation}` のペアを保持）を **module 私有**にし export しない
   - 対外には読み取り専用の `destinationAtom` / `customStationAtom`（setter 無し）と、**唯一の書き込み口 `setDestinationAtom`** のみ公開
   - 6 個の handler は全て `set(setDestinationAtom, ...)` 一回の呼び出しに塌缩。物理的に「半分だけ書く」ことが不可能になり、永続化漏れも起きない（`1c9a8a1` の双根因を同時に根治）
   - 迂回しようとする書き方は、private atom にアクセスできないためコンパイル時に失敗する

3. **overlay の 9 フラグを単一 `overlayAtom`（オブジェクト）に統合** + 意味づけされた write atom 群
   - `setTimeout` 瀑布鎖は write atom 内部に **1:1 で原様移植**（時長・順序を変えない）。`overlay.ts` 一箇所に集中させ、page.tsx に散らさない

4. **データ加載層は async/loadable atom を採らず、`primitive atom + useEffect→setAtom` を維持**
   - fetch は一度きりで以降読み取り専用、初値は安全な空容器、消費側に空態 fallback あり
   - MapView は data ready 前に mount して onReady アニメを発火する必要があり、Suspense で挂起できない
   - `areaFeatures` は next-intl の `useLocale()`（hook は component tree 内でしか呼べない）に依存するため、いずれにせよ effect 橋が必要
   - 現状と byte-for-byte 等価を保ち、自動テストの無い環境での手動 verify コストを最小化する

5. **component は atom を直接消費**（`useAtomValue` / `useSetAtom`）
   - props drilling（最深 2 層）を解消する方針。`components/ → lib/` の単向依存は維持されるため Domain Layering を侵さない
   - トレードオフ：component が global store に結合し単体での再利用性は下がるが、これらは page 専用 component であり実害は小さい

6. **永続化は atom 層に集約**
   - `destination` は `setDestinationAtom` 内で `serializeDestination` を呼び `STORAGE_KEYS.destination` に書く（`atomWithStorage` は使わない — storage schema `{type:'custom'|'default'}` とメモリ形状が異なり、`customStation` と 1 本の JSON を共有するため一対一マッピングが不変量を割る）
   - `aiCache` は形状が単一なので `atomWithStorage`（`getOnInit: false` で hydration mismatch 回避 + 自前 storage で旧 v1 互換 / 壊れデータの silent ignore）

7. **SSR 安全のため明示的 `<Provider>`**（`app/providers.tsx`、`NextIntlClientProvider` 内側）

## Why（代替案との比較）

| 案 | 評価 |
|---|---|
| **Jotai（採用）** | atom 粒度が page.tsx の「細粒度・相互独立な多数の状態」に最適。派生 write atom で不変量を単一書き込み口に封じられる。漸進導入が容易（一状態ずつ移行）。 |
| Zustand | 単一 store の自顶向下モデル。本 case の原子化された状態群には粒度が合わず、不変量封じ込めも slice 設計の規律頼みになる。 |
| React Context + useReducer | 不変量は reducer に集約できるが、データ加載 / 派生 / overlay まで含めると Context が肥大化し re-render 最適化が手作業になる。 |
| 現状維持（useState） | 不変量が人的規律頼みのままで `1c9a8a1` 類のバグが再発する。却下。 |

## Trade-offs

1. **新規依存の追加**（jotai 1 package、transitive 依存なし）
2. **component が global atom に結合** — 単体再利用性は下がる（page 専用なので実害小）
3. **移行期間中は新旧パターンが混在** — 分階段で進めるため、各段階で page.tsx は「一部 atom + 一部 useState」の中間状態を経る
4. **自動テストが無いため各段階で手動 verify が必須** — これを前提に、各段階を独立 commit・独立回退可能に設計

## Migration phases（各段階＝独立 commit・独立回退）

| 段階 | 内容 | リスク |
|---|---|---|
| **P0** | jotai 導入 + `app/providers.tsx` + 本 ADR（page.tsx 不動） | 極低 |
| **P1** | 叶子 UI atom（maxMinutes / maxTransfers / selectedStation） | 極低 |
| **P2** | データ加載層 9+1 atom + `hooks/useDataLoaders` | 低 |
| **P3** | 核心領域 + 不変量锁（`commuteTargetAtom` / `setDestinationAtom`） | 中（`1c9a8a1` 核心検収点） |
| **P4** | `aiCache`（atomWithStorage）+ 派生層（customCommutes / aiHighlight） | 中 |
| **P5** | overlay 状態機 + `setTimeout` 移植 | 最高 |
| **P6** | barrel export + 文書整理 | 極低 |

設計判断の起点となった 3 案独立設計 + 評審の詳細は、本 ADR の Decision 節に集約済。

## When to revisit

- overlay の `setTimeout` 直書きが将来さらに複雑化したら、調度層（pending-timers atom や XState 等）への昇格を検討
- データ加載層が増えて空態管理が辛くなったら、async/loadable atom + Suspense 境界の導入を別 ADR で検討
- component の atom 直接消費が単体テスト導入の障害になったら、props 注入への部分回帰を検討

## 関連

- ADR-0002: [`0002-just-in-time-architecture.md`](./0002-just-in-time-architecture.md)（本移行は ADR-0002 の B 清单「lib/hooks で page.tsx を分解」の発動例）
- SSOT 層: `lib/storage-keys.ts` / `lib/types/index.ts` / `lib/constants.ts`
