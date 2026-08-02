# 0016 Multi-angle audio sync offset persistence

## Status

Accepted

## Date

2026-07-26

## Related ADRs

- Supersedes: [0007 Audio sync offset contract](0007-audio-sync-offset-contract.md)
- Superseded by: N/A

## Context

ADR 0007 は `video_0` を基準とするsigned offsetと加算による適用式を定めたが、保存値は単一の `syncOffset` を前提としていた。最大8アングルへ拡張した後も単一値を全対象へ適用すると、アングルごとに異なる同期位置を保持できない。一方、既存パッケージの `syncData.syncOffset` は引き続き読み込む必要がある。

クリップ単位の `timelineStartSeconds` は同一アングル内の断片配置を表し、アングル単位の再生offsetとは責務が異なる。両者を混同せず、既存の符号契約を維持したままマルチアングルの保存形式を定める。

## Decision

- `VideoSyncData.angleOffsets` をアングルindexに対応する任意の配列として保存し、`angleOffsets[0]` は基準アングルのため `0` とする。
- 対象アングルの再生時刻は `targetTime = globalTime + angleOffsets[index]` で求める。正負の意味はADR 0007の `syncOffset` と同じとする。
- `angleOffsets[index]` が存在しない旧データは、`syncOffset` を後方互換値として対象アングルへ適用する。
- `syncOffset` は必須の互換フィールドとして維持し、従来の2アングル音声解析と手動同期では第2アングルの値を表す。
- IPC境界では最大8要素、有限値、絶対値24時間以内を検証する。
- `timelineStartSeconds` はクリップの絶対配置、`angleOffsets` はアングル単位の再生補正として別々に扱う。

## Consequences

- 3アングル以上で個別offsetを保持しながら、`syncOffset` だけを持つ旧パッケージを読み込める。
- 配列のindexは `.metadata/config.json` の `angles[]` と同じ順序を維持する必要がある。
- 一部indexだけが欠けた場合は互換値へフォールバックするため、新形式を書き出す処理は可能な限り全アングル分の配列を保持する。
- offsetの符号または適用式を変更する場合は、保存データmigration、IPC guard、再生計算、仕様書、テストを同じ変更で更新する必要がある。
