# SporTagLytics AGENTS Guide

## 目的と適用範囲
このドキュメントは、SporTagLytics の AI 支援開発（Codex / Copilot / 各種エージェント）に適用する実装規約です。
最優先事項は **保守性・可読性・責務分離** です。

## 規約の優先順位
規約が競合した場合は、次の順で優先します。

1. `AGENTS.md`（本ファイル）
2. `.github/copilot-instructions.md`
3. `.github/instructions/*.instructions.md`
4. `.github/technical-instructions.md`

## 技術基準（現行実装）
- React 19 系（関数コンポーネントのみ）
- TypeScript 5.4 系（`strict: true`）
- Electron 40 系
- Material UI 7 系
- Video.js 8 系
- pnpm 9 系

## ディレクトリ責務
- `electron/src`: Main process。ウィンドウ管理、IPC handler、ファイル I/O、OS 依存処理。
- `src/pages`: 画面単位のコンテナ。Feature の組み合わせと画面遷移を担当。
- `src/features`: 機能単位モジュール。UI・hooks・utils を機能責務で保持。
- `src/components`: 複数 feature/page で再利用する共通 UI。
- `src/hooks`: 複数 feature/page で再利用する共通 hook。
- `src/utils`: 複数 feature/page で再利用する純粋関数・ユーティリティ。
- `src/types`: 共有型定義。
- `src/contexts`: グローバルな React Context。
- `src/renderer.d.ts`: `window.electronAPI` など Renderer 側の公開型。

## 依存方向ルール
依存方向は次を原則とします。

- `pages -> features -> shared`
- `shared` は `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`（必要に応じて `src/shared` を追加）

禁止事項:
- `features -> pages` の依存
- feature 内部実装への他 feature からの直接 import

許可事項:
- 共通コンポーネント・共通型・共通 hook・共通 util の横断利用

feature 間で再利用が必要な場合:
1. まず共通化を検討し、`shared` 層へ抽出する。
2. 例外を作る場合は、理由・範囲・解消予定を PR に明記する。

## 命名規約
- Component: `PascalCase`（例: `VideoPlayerLayout.tsx`）
- Hook: `useXxx`（例: `useTimelineViewport.ts`）
- util/service module: `camelCase`（例: `timelineExport.ts`）
- Type / Interface / Enum: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`

## 実装規約
### TypeScript
- `any` は原則禁止。不可避の場合のみ理由コメントを添える。
- `unknown` を使い、型ガードで絞り込む。
- exported 関数は戻り値型を明示する。
- 根拠のない `as` 断定キャストを禁止する。
- 型 import は `import type` を優先する。

### React
- Container / Hook / View の責務を分離する。
- `useEffect` は依存配列を完全に記述し、クリーンアップを実装する。
- 重い計算・ハンドラは `useMemo` / `useCallback` で安定化する。
- 空状態・エラー状態を明示する（例: Placeholder / Alert / Snackbar）。

### UI (MUI)
- スタイルは `sx` + テーマ経由を基本とする。
- 色・余白・タイポグラフィのハードコードを避け、`src/theme.ts` を参照する。

### Electron / IPC
- Renderer から Electron 機能を使う経路は `window.electronAPI` のみ。
- `src` 側で `electron` / `ipcRenderer` を直接 import しない。
- IPC の型定義は `src/renderer.d.ts` を正として更新する。

## 既存逸脱コードの扱い
- 理想構成を規約として維持する。
- ただし通常の機能開発では、既存コードを無理に全面移行しない。
- 既存逸脱の解消は「専用リファクタ」タスクで計画的に実施する。

## 変更時チェックリスト
- [ ] 変更が責務境界を壊していない（`pages -> features -> shared`）。
- [ ] 新規の feature 間直接依存を作っていない。
- [ ] 型安全性を維持している（`any` 追加なし、危険な cast なし）。
- [ ] Renderer の Electron 呼び出しが `window.electronAPI` 経由である。
- [ ] ユーザー影響がある場合、`docs/` の関連文書を更新した。
- [ ] 最低限 `pnpm exec tsc --noEmit` を実行した。
- [ ] 最低限 `pnpm exec tsc -p electron/tsconfig.json` を実行した。
