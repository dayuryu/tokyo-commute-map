# Architecture Decision Records (ADR)

このフォルダは Kayoha プロジェクトの主要な設計判断を時系列で記録する。

## なぜ ADR を書くか

- 「6 ヶ月後の自分」が「なぜこうしたのか」を 5 分で思い出せる
- 同じ議論を繰り返さない
- トレードオフを明示しておくことで「ここを変えると何が壊れるか」が分かる

## フォーマット

各 ADR は 1 つの md ファイル、`<番号>-<kebab-case-title>.md`。本文は概ね以下：

```markdown
# <番号>. <タイトル>

**Status:** Accepted | Superseded by ADR-XXX | Deprecated
**Date:** YYYY-MM-DD

## Context
（背景。何が問題だったか）

## Decision
（採用した方針）

## Why
（なぜそうしたか。代替案との比較）

## Trade-offs
（この決定で諦めたもの・将来の制約）

## When to revisit
（この前提が変わったら見直すべき条件）
```

## 既存 ADR

採番は連続。`Superseded` 状態の ADR も削除せず、新 ADR に「Supersedes ADR-XXX」を書いて残す。

- *placeholder — 0001 から順次追加*

## 反屎山戦略全体

ADR の哲学的背景は [`../todo.md`](../todo.md) の「🏗️ 基礎工程」section と memory
`project_maintenance_strategy.md` を参照。
