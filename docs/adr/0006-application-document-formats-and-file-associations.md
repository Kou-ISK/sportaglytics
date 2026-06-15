# 0006 Application Document Formats and File Associations

## Status

Accepted

## Date

2026-05-05

## Context

SporTagLytics は project package、playlist、code window、dashboard をユーザーがファイルとして保存・共有できる desktop application です。これらの拡張子と OS file association はユーザー操作、Finder / Explorer 表示、ダブルクリック起動、配布設定に影響します。

保存形式や関連付けを実装詳細として扱うと、互換性、アイコン、document role、package directory の扱いが drift しやすくなります。

## Decision

`.stpkg`, `.stpl`, `.stcw`, `.stad` を application document format として扱い、OS file association は public contract として維持します。

- `.stpkg` は SporTagLytics package とし、映像、タイムライン、設定を含む project package として扱う。
- `.stpl` は playlist package とし、playlist data と必要に応じた video assets を含む。
- `.stcw` は code window layout document とし、JSON document として扱う。
- `.stad` は analysis dashboard package とし、dashboard import/export の document format として扱う。
- macOS では UTI / document type / icon / package directory の扱いを `electron-builder.json` と `public/icons` で維持する。
- Windows / Linux では `electron-builder.json` の file association を維持する。
- 拡張子、内部構造、document role、package directory 扱いを変更する場合は user guide、custom file icon docs、requirement、必要なら migration docs を同じ PR で更新する。

## Consequences

- ファイル形式と OS 連携を user-facing contract としてレビューできる。
- 保存形式変更時に backward compatibility と migration の検討が必須になる。
- packaging config、icons、docs の同期コストは増えるが、配布後の document association 破壊を防ぎやすい。
