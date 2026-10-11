---
applyTo: 'src/pages/**/*.ts,src/pages/**/*.tsx,src/App.tsx'
---

# Page Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

pageの責務と依存方向は [AGENTS.md](../../AGENTS.md#アーキテクチャ方針) を参照する。

- page専用stateは最小化し、再利用するドメイン処理の配置は [Project Structure](../../docs/project-structure.md) で判断する。
