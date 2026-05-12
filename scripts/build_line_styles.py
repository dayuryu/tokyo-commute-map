#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_line_styles.py

station_database/out/main/line/*.json から
路線名 → {color, symbol} の dict を抜き出して
public/data/line_styles.json に出力する。

stations.geojson の line_names 配列とジョインする想定:
  stations.geojson の `properties.line_names` で名前を取り、
  この line_styles.json で color/symbol を引く。

使い方:
  python scripts/build_line_styles.py [<station_database_dir>]
"""

import sys, json, glob
from pathlib import Path


def main():
    if len(sys.argv) >= 2:
        base = Path(sys.argv[1])
    else:
        base = Path("../station_database")

    line_dir = base / "out" / "main" / "line"
    if not line_dir.exists():
        line_dir = base / "src" / "line"
    if not line_dir.exists():
        print(f"❌ 路線データディレクトリが見つかりません: {line_dir}")
        sys.exit(1)

    styles = {}
    total = with_color = with_symbol = 0
    for fp in sorted(line_dir.glob("*.json")):
        try:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
        except Exception:
            continue
        if d.get("closed"):
            continue
        name = d.get("name")
        if not name:
            continue
        total += 1
        color = d.get("color")
        symbol = d.get("symbol")
        # 路線名が重複してたら最初を採用（出現順安定）
        if name in styles:
            continue
        styles[name] = {
            "color":  color or None,
            "symbol": symbol or None,
        }
        if color:  with_color  += 1
        if symbol: with_symbol += 1

    out = Path("./public/data/line_styles.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(styles, f, ensure_ascii=False, separators=(",", ":"))

    print(f"非废线 {total} 条 → {out}")
    print(f"  color 付与: {with_color} ({100*with_color/total:.1f}%)")
    print(f"  symbol 付与: {with_symbol} ({100*with_symbol/total:.1f}%)")


if __name__ == "__main__":
    main()
