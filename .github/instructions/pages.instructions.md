---
applyTo: 'src/pages/**/*.ts,src/pages/**/*.tsx,src/App.tsx'
---

# Page Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. pages はルーティングと feature 合成に限定し、業務ロジックを持ち込まない。
2. `src/features/**` は `src/features/<feature>/index.ts` からのみ import する。
3. page 専用 state は最小化し、再利用ロジックは feature または共通 hook へ移す。
4. Electron API 呼び出しは `window.electronAPI` 経由のみで行う。
