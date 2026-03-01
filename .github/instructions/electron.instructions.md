---
applyTo: 'electron/src/**/*.ts'
---

# Electron Main/Preload Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. `BrowserWindow` は `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` を維持する。
2. preload は `contextBridge` で用途別 API のみ公開し、汎用イベントバスを追加しない。
3. IPC handler では payload/sender 検証を行う。
4. 不要な `window.open` とナビゲーションを拒否する。
