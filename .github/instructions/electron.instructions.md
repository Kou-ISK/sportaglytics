---
applyTo: 'electron/src/**/*.ts'
---

# Electron Main/Preload Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

IPCとBrowserWindowの基準は [AGENTS.md](../../AGENTS.md#electron--ipc-規約) を参照する。

- Main/preloadの公開契約を変更する場合は `src/renderer.d.ts` と呼出側を同じPRで確認する。
- bundle/preload sanityと対応OSのE2Eの選び方は [Testing](../../docs/testing.md#settings--timeline--ipc) を参照する。
