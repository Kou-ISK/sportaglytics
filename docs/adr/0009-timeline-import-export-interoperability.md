# 0009 Timeline Import/Export Interoperability

## Status

Accepted

## Date

2026-05-06

## Context

SporTagLytics のタイムラインはアプリ内部の分析、プレイリスト、AI 分析、レポート生成の基礎データです。一方で、ユーザーは JSON、CSV、Sportscode SCTimeline 形式で外部ツールとデータをやり取りします。

import/export を UI hook に閉じ込めたり、形式ごとの互換性を暗黙実装にすると、`TimelineData` の保存モデル、labels migration、SCTimeline 変換、CSV の情報欠落範囲が drift しやすくなります。

## Decision

タイムライン import/export は、アプリ内部 JSON を canonical format とし、CSV と SCTimeline を interoperability format として扱います。

- JSON は SporTagLytics の full-fidelity timeline format とし、内部保存モデルに最も近い形式として扱う。
- CSV は人間が扱いやすい交換形式とし、labels やアプリ内部 metadata を完全保持しない lossy format として扱う。
- SCTimeline は Sportscode 互換形式とし、`TimelineData` と SCTimeline row / instance 構造の変換を pure converter に閉じ込める。
- import は JSON としての読み込みを先に試し、失敗時に SCTimeline として判定する。
- import 成功時は現在のタイムラインを置き換え、暗黙 merge は行わない。
- `TimelineData.labels` を中心モデルとし、旧 `actionType` / `actionResult` は読み込み時の互換入力として扱う。
- file dialog、menu subscription、read/write gateway、serialize / deserialize service を分離し、UI hook に I/O と変換ロジックを同居させない。

## Consequences

- 外部ツール連携と内部モデル変更の責務境界が明確になる。
- labels 中心モデルへ移行しても、旧データと SCTimeline からの読み込み互換を維持しやすい。
- CSV は full-fidelity backup ではないことを docs と UI で説明する必要がある。
- 将来 merge import、部分 import、別外部形式を追加する場合は、canonical / lossy / interoperability のどれに該当するかを明示して実装する。
