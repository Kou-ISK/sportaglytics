# 0061 Event Pack Distribution Provenance

## Status

Accepted

## Date

2026-10-12

## Context

event packのmanifest schema 1/2は実行可否と品質を扱い、基盤checkpointや学習データの許諾を表現しない。任意stagingをそのまま配布物へコピーできるため、runtime hash検証の成功だけでは公開再配布を判断できない。既存ローカルpackの利用は維持する必要がある。

## Decision

公開consumer/private R&Dの境界とruntime manifestを維持し、配布用sidecar `distribution-provenance.json`を導入する。出典URL・revision・元bytesのhash・license/NOTICE・利用制限・公開可能なレビュー記録を、署名前manifestと全packファイルへ結び付ける。packaging後、runner署名前にすべてのpackを検査し、未記録・未承認・不整合なら配布工程を失敗させる。モデルなし配布は許容する。

元checkpointのhash、repositoryのrevision、派生物のhashを区別する。機械検査は記録とbytesの整合に限定し、権利判断は管理者が行う。学習動画、private repoや非公開契約は公開側へ移動しない。仕様は[配布前レビューと由来記録](../event-pack-provenance.md)を正本とする。

## Consequences

既存ローカルpackの実行時互換を維持しつつ、同梱時には由来記録が必要になる。macOS署名はrunnerとruntime manifestのhashを変更するため、sidecarは署名前証拠として保持し、署名後hash・installer checksumを別に記録する。記録だけで法的適合や独自性を保証せず、現行私有packを承認済みとみなさない。[ADR 0023](0023-external-rugby-event-model-rd-boundary.md)と[ADR 0060](0060-distribution-license-evidence.md)の境界を補完する。
