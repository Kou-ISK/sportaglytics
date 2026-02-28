# Technical Instructions - SporTagLytics

このファイルは、実装時に迷わないための技術判断基準を簡潔に示します。
詳細仕様は `AGENTS.md` と `docs/system-overview.md` を参照してください。

## 1. 実行責務（Main / Preload / Renderer）
- Main（`electron/src`）: ウィンドウ管理、IPC ハンドラ、ファイル I/O、OS 連携。
- Preload（`electron/src/preload.ts`）: 安全な IPC ブリッジ公開。
- Renderer（`src`）: UI とアプリロジック。Electron 呼び出しは `window.electronAPI` のみ。

## 2. ディレクトリ境界
- `src/pages`: 画面コンテナ
- `src/features`: 機能モジュール
- `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`: 共通層

依存方向:
- `pages -> features -> shared`
- `features -> pages` は禁止
- feature 間の内部実装への直接依存は原則禁止（共通化を優先）

## 3. レビュー観点
- 可読性: 1ファイルの責務が明確か、命名が意図を表しているか。
- 責務分離: Container / Hook / View が分離されているか。
- 副作用分離: `useEffect` の依存配列と cleanup が適切か。
- 型安全: `any` や危険な cast に依存していないか。
- IPC 安全性: Renderer からの直接 `ipcRenderer` 利用が混入していないか。

## 4. 運用方針
- 理想構成は厳格に維持する。
- 既存コードの逸脱を通常タスクで無理に全面移行しない。
- 逸脱解消は専用リファクタで段階的に進める。

## 参照
- `AGENTS.md`
- `docs/system-overview.md`
