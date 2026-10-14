---
applyTo: 'src/features/**/*.ts,src/features/**/*.tsx'
---

# Feature Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

依存方向・公開面・責務分離は [AGENTS.md](../../AGENTS.md#アーキテクチャ方針) を参照する。

- 新しい公開要素を追加する際は、対象featureの `index.ts` と呼出側を同じ差分で確認する。
- feature間で共有する必要がある契約の配置は [Project Structure](../../docs/project-structure.md) を参照する。
