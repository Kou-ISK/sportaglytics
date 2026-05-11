# 0008 Dedicated Sub-Window Runtime and Synchronization

## Status

Accepted

## Date

2026-05-06

## Context

SporTagLytics は main window に加えて、分析ウィンドウとプレイリストウィンドウを Electron `BrowserWindow` として独立表示します。これらのウィンドウは別 renderer runtime を持つため、main window の状態を暗黙共有できません。

sub-window を通常の画面ルートと同じ前提で扱うと、sender 検証漏れ、状態同期の二重管理、未保存状態の取りこぼし、`window.electronAPI` の公開面肥大化が起きやすくなります。

## Decision

分析ウィンドウとプレイリストウィンドウは、専用 BrowserWindow runtime と明示的な IPC sync contract で扱います。

- 分析ウィンドウは singleton とし、既に開いている場合は focus、未作成なら `#/analysis` で作成する。
- プレイリストウィンドウは複数同時表示を許可し、file path または generated window id で管理する。同じ `.stpl` file path は既存 window を focus する。
- すべての sub-window は `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` と `applyWindowSecurity` を適用する。
- main / sub-window 間の通信は `src/types/ipc/*` の channel、payload 型、type guard を正本にする。
- main process は sender window を検証し、main window からの sync、analysis window からの jump / playlist 作成要求、playlist window からの command / dirty state を区別する。
- renderer は `window.electronAPI.analysis` / `window.electronAPI.playlist` と feature gateway を通し、View から IPC を直接呼ばない。
- sub-window へ渡す状態は typed snapshot / command とし、renderer 間で mutable state を暗黙共有しない。

## Consequences

- ウィンドウごとの lifecycle、未保存状態、同期方向を追跡しやすくなる。
- sub-window 固有 IPC が top-level API や汎用 event bus に漏れにくい。
- 新しい専用ウィンドウを追加する場合は、singleton か multi-instance か、window id、sender 検証、sync payload を最初に設計する必要がある。
- 状態同期の明示化により実装量は増えるが、Electron security baseline と Feature-First 境界を維持しやすい。
