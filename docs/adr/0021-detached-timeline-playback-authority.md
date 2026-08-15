# 0021 Detached Timeline and Playback Authority

## Status

Accepted

## Date

2026-08-15

## Related ADRs

- Extends: [0008 Dedicated Sub-Window Runtime and Synchronization](0008-dedicated-sub-window-runtime-and-synchronization.md)
- Superseded by: N/A

## Context

映像とタイムラインを同じ renderer layout に置くと、映像表示と編集領域が互いの高さを圧迫し、外部ディスプレイを使う分析作業にも適合しにくい。一方、タイムラインを独立 renderer に移して再生状態まで所有させると、Video.js の実時刻と編集側の時刻が競合し、シーク、再生速度、選択状態がドリフトする。

独立ウィンドウにフォーカスがある場合も、映像操作ホットキーはメイン動画 runtime の同じ処理へ到達する必要がある。renderer 間で mutable state を共有したり、汎用 IPC event bus を公開したりせずにこの操作を成立させる境界が必要である。

## Decision

- 映像ウィンドウを再生時計、Video.js player、タイムライン document、履歴の唯一の authority とする。
- タイムラインは singleton の専用 `BrowserWindow` とし、映像パッケージを開いたときに表示する。閉じた後は OS の「ウィンドウ」メニューから再表示する。映像面にはタイムライン再表示用の常設オーバーレイを置かない。
- 映像側からタイムライン側へ document/選択の `TimelineWindowSyncPayload` と、高頻度でも小さい `TimelineWindowClockPayload` を分けて送り、タイムライン側の編集、シーク、選択、Undo/Redo、プレイリスト追加、ホットキー入力は `TimelineWindowCommand` として映像側へ戻す。
- channel、payload、command、型ガードの正本は `src/types/ipc/timelineWindow.ts` とし、main process は sender window を検証する。
- タイムライン renderer は短い間隔の同期時刻間を compositor-friendly な linear transition で補間する。ドラッグ中は transition を外して即時表示し、映像への連続シークは最新入力を1フレームに集約する。
- View は Electron API に依存させず、gateway と Controller/Hook が IPC と楽観的なシーク表示を担当する。

## Consequences

- 映像とタイムラインを別ディスプレイへ自由に配置でき、どちらのウィンドウにフォーカスがあっても設定済み映像ホットキーを同じ main runtime へ送れる。
- 再生状態と編集履歴は一箇所に残るため、独立 renderer 間の競合を避けられる。
- ウィンドウ再表示の導線は OS メニューへ集約され、映像面のオーバーレイ UI を増やさずに済む。
- タイムライン側の transition と楽観的なシーク位置は表示専用であり、保存データや再生 authority として扱ってはならない。
- 再生中に timeline document 全体を IPC serialize しないため、長時間・多数インスタンスでも clock sync の payload size は一定になる。
- 新しいタイムライン操作を追加する場合は command union、preload guard、main controller の処理を同時に更新する必要がある。
