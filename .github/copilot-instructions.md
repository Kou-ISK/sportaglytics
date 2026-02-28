# Copilot Instructions（SporTagLytics）

このリポジトリで提案するコードは、保守性・可読性・責務分離を最優先にしてください。

## 規約の優先順位
規約が競合する場合は次の順で解釈します。

1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `.github/instructions/*.instructions.md`
4. `.github/technical-instructions.md`

## 技術スタック（現行）
- React 19 系（関数コンポーネントのみ）
- TypeScript 5.4 系（strict mode）
- Electron 40 系
- Material UI 7 系
- Video.js 8 系
- pnpm 9 系

## ディレクトリ責務と依存方向
- `src/pages`: ページコンテナ
- `src/features`: 機能モジュール
- `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`: 共通層（shared）
- `electron/src`: Electron Main process

依存は `pages -> features -> shared` を原則とし、`features -> pages` を禁止します。

feature 間ルール:
- 他 feature の内部実装へ直接 import しない。
- 再利用が必要なら共通層へ抽出してから参照する。
- 共通コンポーネント・共通型の横断利用は許可する。

## 実装方針
### TypeScript
- `any` は原則禁止。
- `unknown` + 型ガードで安全に扱う。
- exported 関数は戻り値型を明示。
- 無根拠な `as` 断定キャストは禁止。
- `import type` を優先。

### React / TSX
- Container（状態とI/O）/ Hook（ロジック）/ View（表示）を分離。
- `useEffect` は依存配列と cleanup を必ず定義。
- 空状態・エラー状態を明示する。

### UI
- MUI の `sx` とテーマを使用し、色や余白のハードコードを避ける。

### Electron
- Renderer 側は `window.electronAPI` 経由でのみ IPC を呼ぶ。
- `src/renderer.d.ts` の型定義を更新して整合を保つ。

## 品質チェック（最低限）
変更提案前に、最低限次を実行してください。

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
```

## ドキュメント更新
ユーザー影響や仕様変更がある場合は、関連する `docs/` を同時に更新してください。
