# SporTagLytics System Overview

SporTagLytics の現行アーキテクチャ概要です。詳細規約は `AGENTS.md` を正とし、本書は実装トレース用の要約に限定します。

## レイヤー構成

- 依存方向: `pages -> features -> shared`
- `pages` は `src/pages/*.tsx` のみを許可し、ルーティングと feature 合成だけを担当
- `features` は `src/features/<feature>/` 配下に `Screen / Controller(or Hook) / View / Gateway / domain` を内包する
- `shared` 相当: `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`, `src/shared`, `src/report`
- `src/hooks` と `src/contexts` には feature 専用サブディレクトリを置かない
- 共通 UI design-system: `src/components/ui`（Shared UI 限定）
- feature 外から feature を参照する場合は `src/features/<feature>/index.ts` の公開 API のみ利用
- Atomic Design はアプリ全体のフォルダ規約としては採用せず、Shared UI 設計のメンタルモデルとして限定運用
- Storybook 対象は `pages` や `Screen` ではなく、shared UI と feature 配下の `View` コンポーネントに限定する

## Electron 構成

- `electron/src/main.ts`: 起動とウィンドウ組み立てに集中
- IPC 登録はドメインごとに分割
  - `electron/src/ipc/fileHandlers.ts`
  - `electron/src/ipc/reportHandlers.ts`
  - `electron/src/ipc/dashboardHandlers.ts`
  - `electron/src/ipc/codeWindowHandlers.ts`
  - `electron/src/ipc/exportHandlers.ts`
  - `electron/src/ipc/llamaHandlers.ts`
- `electron/src/preload.ts`: ドメインブリッジを合成
  - `electron/src/preload/appBridge.ts`
  - `electron/src/preload/eventBridge.ts`
  - `electron/src/preload/settingsBridge.ts`
  - `electron/src/preload/analysisBridge.ts`
  - `electron/src/preload/playlistBridge.ts`
  - `electron/src/preload/codeWindowBridge.ts`

## セキュリティ基準

全 BrowserWindow で以下を適用:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`

加えて `electron/src/windowSecurity.ts` で以下を標準化:

- `window.open` を拒否
- 許可されないナビゲーションを拒否

## Renderer API 方針

- Renderer は `window.electronAPI` のみを利用
- 汎用 `on/off/send` は廃止し、用途別の明示 API に統一
- ローカルファイル読込で `fetch(filePath)` は使用しない
  - `readJsonFile`
  - `readTextFile`
  - `readBinaryFile`

## 主要データモデル

- `TimelineData` は `labels` 中心モデル
- 旧フィールド `actionType` / `actionResult` は型から削除
- 旧データは読込時にマイグレーションし、保存時は新形式のみ出力
- `AnalysisView` は shared 型 (`src/types/AnalysisView.ts`) を利用
- playlist 同期は `PlaylistSyncData` を正とし、playlist 画面・hooks の契約を統一
- playlist window の同期 hook は IPC 登録を gateway helper、payload 正規化を snapshot helper に分離し、hook 本体では state 適用だけを扱う
- playlist window の runtime は `data runtime` と `interaction runtime` に分け、state 合成と playback/hotkey 合成を分離する
- プレイリスト追加は `src/features/playlist` の公開 API に集約し、renderer からの個別 IPC 呼び出しを分散させない
- 音声同期の相関解析は `src/utils/audioSync/` 配下で stage helper に分割し、探索ロジックと orchestration を分離する
- event insights の shared domain は facade と builder 群に分け、summary/stat family ごとの集計責務を分離する

## 品質ゲート

- `pnpm run typecheck`
- `pnpm run typecheck:electron`
- `pnpm run lint`
- `pnpm run test:run`
- `pnpm run check:architecture`
- `pnpm run report:architecture-health`（準拠率の可視化）

## ファイル分割運用

- 行数は Soft Budget（Warn Only）:
  `TSX <= 300行`, `TS <= 450行`
- CI fail 条件は行数ではなく、境界違反・型・テスト
- 規約例外は `docs/architecture-exceptions.md` で管理
- 月次レポートは `pnpm run report:large-files` で生成
