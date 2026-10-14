---
applyTo: 'src/shared/**/*.ts,src/shared/**/*.tsx,src/utils/**/*.ts,src/types/**/*.ts,src/contexts/**/*.ts,src/contexts/**/*.tsx,src/report/**/*.ts,src/report/**/*.tsx'
---

# Shared Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

依存方向と互換データの扱いは [AGENTS.md](../../AGENTS.md#アーキテクチャ方針) と [TypeScript規約](../../AGENTS.md#typescript-実装規約) を参照する。

- sharedのドメイン計算はpure functionを優先し、副作用を分離する。この `applyTo` に含まれるContextやreport UIへ一律のUI禁止を適用しない。
- 複数featureが使う互換変換はsharedへ集約し、共有型は `src/types` または `src/shared` で定義する。
