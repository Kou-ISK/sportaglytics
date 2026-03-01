---
applyTo: '**/*.ts'
---

# TypeScript Files (`*.ts`)

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. exported 関数・メソッドは戻り値型を明示する。
2. 型のみの import は `import type` を使う。
3. `any` は禁止し、必要な場合は `unknown` と型ガードを使う。
4. 互換データは型へ残さず、変換関数で吸収する。
