# 0087 Organizer row membership and presentation order

## Status

Accepted

## Date

2026-11-23

## Related ADRs

- Supersedes: [0047](0047-playlist-sorter-presentation-order.md)
- Superseded by: N/A

## Context

コーチは試合場面の発表順を組んだ後で、個別配布のためにクリップをテーマ行へ分類する。同じ行名やアクション名を使うこともある。

## Decision

Sorter の `presentationOrder` は再生、保存、出力に共通とする。Organizer の行順と所属だけを編集してもこの順序を維持する。行を指定した再生・出力は全体順の部分列を使用する。行別出力のキーは永続的な行IDとし、同名の出力ファイルには既存の衝突回避命名を使う。全体順を変える Sorter の操作は明示的な文書編集として Undo できる。旧文書の移行は0047の規則を維持する。

## Consequences

行は空のときだけ削除でき、最後の1行は残る。移動先にすでに所属するクリップはその場に残る。行の既存の有効表示は出力の暗黙フィルターにしない。従来のアクション別出力は同じアクション名をまとめる。

## Meeting slides

Slides are independent presentation items with row membership, stable identity, editable text and an optional bounded PNG inside the document. They have no video reference. Their explicit whole-second duration is the presentation and export duration. Sorter reorders them through the same undoable operation as clips. Existing documents acquire no slide content on load. Export uses the meeting canvas and mixes regular media only after applying the existing angle, Paint and text settings.
