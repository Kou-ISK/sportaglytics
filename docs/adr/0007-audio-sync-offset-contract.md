# 0007 Audio Sync Offset Contract

## Status

Accepted

## Date

2026-05-06

## Context

SporTagLytics は複数映像を同じタイムライン上で再生します。音声同期は `video_0` を基準にし、2 番目以降の映像へ `offsetSeconds` を適用して同期します。

この値は符号の意味を誤ると、再生位置のずれ、音声のエコー、デバッグ困難な同期不良につながります。相関解析の実装詳細よりも、`offsetSeconds` の意味と適用式を長期的な契約として固定する必要があります。

## Decision

音声同期 offset は `video_0` 基準の signed offset contract として扱います。

- `video_0` は常に基準映像とし、グローバル再生時刻をそのまま使う。
- `video_1` 以降は `targetTime = globalTime + offsetSeconds` で再生位置を決める。
- `offsetSeconds > 0` は対象映像が `video_0` より早く始まっている状態を表す。
- `offsetSeconds < 0` は `video_0` が対象映像より早く始まっている状態を表す。
- 音声は `video_0` のみを標準で再生し、2 番目以降の映像はミュートして重複音声を避ける。
- 相関解析アルゴリズムや解析区間は改善してよいが、返す offset の符号と適用式を変える場合は migration、仕様 docs、テストを同じ変更で更新する。

## Consequences

- 同期 offset の符号と適用方法がレビュー可能な public contract になる。
- 音声同期処理の内部最適化をしても、renderer 側の適用式とユーザー向け挙動を保ちやすい。
- 過去に生成済みの package や sync metadata と互換性を維持する責務が明確になる。
- offset contract を変更する場合は、単なるバグ修正ではなく保存データ互換性を伴う設計変更として扱う必要がある。
