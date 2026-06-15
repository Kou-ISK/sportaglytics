# 0010 FFmpeg Clip Export Execution Boundary

## Status

Accepted

## Date

2026-05-06

## Context

プレイリストとタイムラインからのクリップ書き出しは、映像ファイル、複数アングル、描画 overlay、フリーズフレーム、FFmpeg 実行を扱います。これは renderer UI の状態管理よりも副作用が大きく、file system と native process execution を伴います。

書き出し条件の解決、source validation、FFmpeg 実行、progress 通知を同じ層に混在させると、Electron security boundary、テスト容易性、プレイリストとタイムライン間の再利用性が崩れます。

## Decision

クリップ書き出しは shared planning / validation と Electron main-side execution を分離します。

- `src/shared/clipExport/` は型、source selection、validation、export plan orchestration を保持する。
- renderer / feature 側は timeline item から clip list、overlay settings、export mode、angle option を組み立てる。
- FFmpeg command execution、file system access、save dialog、native process lifecycle は Electron main process IPC handler に閉じ込める。
- renderer は `window.electronAPI` と gateway 経由で書き出しを依頼し、FFmpeg command を直接構築・実行しない。
- `allAngles` は利用可能な各 video source を single-angle export として順に処理する。
- `multi` は異なる primary / secondary source を必須とし、source が不足または同一の場合は export 前に validation error とする。
- overlay と annotation は export payload の明示的な設定として扱い、暗黙の UI state 参照に依存しない。

## Consequences

- FFmpeg 実行境界を Electron main process に固定でき、renderer security model を維持できる。
- source validation と export orchestration を unit test しやすい。
- playlist と timeline の export UX を共有しながら、feature 側は clip selection と UI state に集中できる。
- 将来 background queue、remote export、GPU encoder、別 media tool を追加する場合は、execution boundary と user-facing failure handling を再設計する必要がある。
