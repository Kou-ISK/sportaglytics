# 0002 Typed Electron IPC and Renderer Gateways

## Status

Accepted

## Date

2026-05-04

## Context

Electron アプリでは renderer から main process の filesystem、window、export、LLM 連携へアクセスします。汎用 `send/on/off` や payload guard のない IPC を増やすと、型安全性、sender 境界、cleanup、preload の公開面が不安定になります。

Renderer の View から直接 `window.electronAPI`、URL、永続化へ触れると Story 化しづらくなり、UI と外部依存の責務が混ざります。

## Decision

Electron 境界は typed IPC と renderer gateway に集約します。

- Renderer からの Electron 呼び出しは `window.electronAPI` の明示 API のみ許可する。
- preload は用途別 domain bridge を合成し、汎用 event bus を公開しない。
- IPC contract は `src/renderer.d.ts` と `src/types/ipc/` を正本にする。
- main / preload / renderer の境界で payload guard と sender validation を行う。
- Renderer 側の Electron / URL / persistence 依存は `Gateway` または `Controller/Hook` に閉じ込め、`View` と `src/components/ui` から直接呼ばない。
- listener は cleanup 可能な typed 登録 API を使い、singleton listener の上書きや `removeAllListeners` 前提の設計を避ける。

## Consequences

- Electron セキュリティ設定と preload の最小公開面を維持しやすい。
- IPC channel 追加時に payload 型、guard、sender 検証を合わせてレビューできる。
- View は props と callback で描画できるため、テストや Storybook 対象にしやすい。
- 小さな変更でも gateway / type / guard の更新が必要になり、初期実装コストは増える。
