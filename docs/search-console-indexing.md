# Search Console URL 索引リクエスト手順（運営側、3〜4 日で完走）

> 2026-06-11 作成。インデックス API は一般ページ非対応のため、ここだけは手動が必要。
> 1 日の上限は約 10 件。下記の優先順に上から消化する。

## 手順（1 件 30 秒）

1. [Search Console](https://search.google.com/search-console) → プロパティ `kayoha.com`
2. 上部の「URL 検査」に下記 URL を貼る → Enter
3. 「インデックス登録をリクエスト」をクリック（既に「登録済み」なら skip して次へ）

## Day 1（最優先 — hub と流入軸）

- https://kayoha.com/to
- https://kayoha.com/ryugaku
- https://kayoha.com/to/shinjuku
- https://kayoha.com/to/shibuya
- https://kayoha.com/to/tokyo
- https://kayoha.com/to/ikebukuro
- https://kayoha.com/to/shinagawa
- https://kayoha.com/to/otemachi
- https://kayoha.com/to/roppongi
- https://kayoha.com/to/toranomon

## Day 2

- https://kayoha.com/to/shimbashi
- https://kayoha.com/to/akihabara
- https://kayoha.com/to/yurakucho
- https://kayoha.com/to/hamamatsucho
- https://kayoha.com/to/tamachi
- https://kayoha.com/to/osaki
- https://kayoha.com/to/gotanda
- https://kayoha.com/to/meguro
- https://kayoha.com/to/takadanobaba
- https://kayoha.com/to/iidabashi

## Day 3

- https://kayoha.com/to/kanda
- https://kayoha.com/to/ochanomizu
- https://kayoha.com/to/akasakamitsuke
- https://kayoha.com/to/omotesando
- https://kayoha.com/to/yokohama
- https://kayoha.com/to/minatomirai
- https://kayoha.com/to/musashikosugi

## Day 4（残り + 任意）

- https://kayoha.com/to/omiya
- https://kayoha.com/to/chiba
- https://kayoha.com/to/tachikawa
- https://kayoha.com/to/oshiage
- https://kayoha.com/to/toyosu
- 任意: Rich Results Test の目視確認（ログイン必須化されたため運営側のみ可能、1 分）
  https://search.google.com/test/rich-results?url=https%3A%2F%2Fkayoha.com%2Fto%2Fshinjuku
  ※ 構造化データ自体は 2026-06-11 にコード側で全 30 駅機械検証済（FAQPage / BreadcrumbList / WebPage 全 PASS）

## 完了後

- 1〜2 週間後に Search Console「ページ」レポートでインデックス状況を確認
- 「カバレッジ」に問題が出た URL があればコード側タスクとして持ち帰る
