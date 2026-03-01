---
applyTo: 'src/features/**/*.ts,src/features/**/*.tsx'
---

# Feature Layer Files

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. feature から `pages` を import しない。
2. 他 feature の内部実装へ直接 import しない（必要なら shared へ抽出する）。
3. feature 外へ公開する要素は `src/features/<feature>/index.ts` に明示する。
4. UI / hook / domain の責務を分離し、責務混在を避ける。
