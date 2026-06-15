---
applyTo: 'src/shared/**/*.ts,src/shared/**/*.tsx,src/utils/**/*.ts,src/types/**/*.ts,src/contexts/**/*.ts,src/contexts/**/*.tsx,src/report/**/*.ts,src/report/**/*.tsx'
---

# Shared Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. shared 層から `src/features/**` を import しない。
2. pure function を優先し、副作用や UI 依存を持ち込まない。
3. 互換処理は shared の変換関数に集約し、呼び出し側へ分散させない。
4. 共有型は `src/types` または `src/shared` で定義し、feature 内型を露出しない。
