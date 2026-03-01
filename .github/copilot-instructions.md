# Copilot Repository Instructions（SporTagLytics）

このファイルは Copilot 向けの入口ガイドです。規約本文は `AGENTS.md` を正本とします。

## 参照順序
1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `.github/instructions/*.instructions.md`
4. `.github/technical-instructions.md`

## Copilot への必須指示
1. 実装・提案は常に `AGENTS.md` を基準に解釈する。
2. 変更対象に一致する `.github/instructions/*.instructions.md` の `applyTo` 差分を適用する。
3. ルールが重なる場合は、より具体的な `applyTo` を優先する。
4. 一般規約を `.instructions.md` に再記述しない。
5. 実装前後で品質ゲート通過を前提にする。

## 品質ゲート
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```
