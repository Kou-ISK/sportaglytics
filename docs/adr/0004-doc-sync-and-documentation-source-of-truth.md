# 0004 Doc Sync and Documentation Source of Truth

## Status

Accepted

## Date

2026-05-05

## Context

SporTagLytics はユーザー向け操作、Electron 境界、保存形式、AI 分析、配布手順を複数の docs で説明しています。実装だけを更新して docs を後追いにすると、ユーザーガイド、開発ガイド、アーキテクチャ要約、ADR、PR レビュー観点がずれ、後続の contributor や AI agent が古い前提で変更するリスクが高くなります。

`docs/` は既にドキュメント正本として運用しており、別 casing の `Docs/` は使いません。

## Decision

ドキュメント正本は `docs/` に固定し、仕様・設計・ユーザー影響・開発手順・配置判断が変わる変更では、同じ PR で該当 docs を更新します。

- ユーザー操作、設定、保存形式、エクスポート形式の変更は `docs/user-guide.md` と必要に応じて `docs/requirement.md` を更新する。
- アーキテクチャ境界、IPC、preload、型契約、保存モデルの変更は `docs/system-overview.md` を更新し、長期判断がある場合は ADR を追加または更新する。
- ディレクトリ構成や新規ファイル配置判断の変更は `docs/project-structure.md` を更新する。
- 開発手順、品質ゲート、レポート運用の変更は `docs/development.md` を更新する。
- 新規 docs を追加した場合は `docs/README.md` に掲載する。
- PR では docs impact を明示し、docs 更新不要の場合も理由を記載する。

## Consequences

- 実装と docs の drift を PR 単位で抑えられる。
- AI agent は `docs/README.md` と docs impact matrix から正しい更新先を判断しやすくなる。
- docs 更新が PR の必須確認事項になり、軽微な内部変更でも「影響なし」の理由を書く手間は増える。
- ADR は運用判断の正本になり、単なる実装差分や一時メモは `docs/adr/` に入れない。
