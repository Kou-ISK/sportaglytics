# 0025 Playlist document presentation order

## Status

Superseded

## Date

2026-08-25

## Related ADRs

- Supersedes: N/A
- Superseded by: [0047](0047-playlist-sorter-presentation-order.md)

## Context

Playlist は従来 `items[]` の flat 配列だけを保存していた。Organizer の row 構造を導入するには行と行内順序が必要だが、Sorter の一時的な表示 sort や window 設定まで document の semantic state に混ぜると、保存・dirty 判定・再生順が不安定になる。また既存 `.stpl` の配列順は失ってはならない。

## Decision

- Playlist Document schema v2 は `rows[]` と item の `rowId` / `rowOrder` を持つ。
- 再生・export・Organizer の正規順序は `row.order` → `item.rowOrder` とし、共有の normalization/presentation helper を通す。
- schema v1 の flat items はロード時に deterministic な既定 row へ移行し、元の配列順を保持する。移行は冪等とする。
- Organizer/Sorter mode、column sort/filter、splitter、Inspector、column layout は window/view state として Playlist Document から分離する。

## Consequences

- 保存前後で presentation order が安定し、legacy `.stpl` も壊さず読み込める。
- Sorter の一時 sort は document の dirty state や再生順を変更しない。
- row を扱う編集操作は domain helper を経由し、window UI が保存形式の詳細を直接操作する必要がない。
