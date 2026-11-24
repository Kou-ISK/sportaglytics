# 0088 Package import source retention

## Status

Proposed

## Date

2026-11-24

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- [0006 Application document formats](0006-application-document-formats-and-file-associations.md)

## Context

拡張子なしの旧プロジェクトを同名の .stpkg として編集したい利用者がいる。Sportscode は複数のタイムラインを持つことがあり、フォルダにある映像だけでは適用するタグと時間軸が決まらない。

## Decision

旧プロジェクトの名前変更は明示選択とする。保存先を排他的に確保し、変換した設定とタイムライン、映像のバイトを読み戻してから原本を復元用に退避する。Sportscode は読取専用の取り込み元とする。利用者が確認した連続映像と公式のタイムライン交換形式 XML を、新しい SporTag プロジェクトに保存する。

## Consequences

旧形式の更新は映像コピーの空き容量が必要になる。変換が中断したときは保存先を自動削除しない。Sportscode 固有のタイムラインのみの入力は XML の書き出しが必要になる。複数映像の連結や時刻の自動推定は行わない。
