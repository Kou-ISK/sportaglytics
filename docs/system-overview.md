# SporTagLytics System Overview

SporTagLytics の現行アーキテクチャ概要です。詳細規約は `AGENTS.md` を正とし、本書は実装トレース用の要約に限定します。

関連する入口:

- [ドキュメント索引](README.md)
- [ドキュメント運用ガイド](documentation-guide.md)
- [プロジェクト構成](project-structure.md)
- [ADR](adr/README.md)

## レイヤー構成

- 依存方向: `pages -> features -> shared`
- `pages` は `src/pages/*.tsx` のみを許可し、ルーティングと feature 合成だけを担当
- `features` は `src/features/<feature>/` 配下に `Screen / Controller(or Hook) / View / Gateway / domain` を内包する
- `shared` 相当: `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`, `src/shared`, `src/report`
- `src/utils` は pure helper を優先し、Electron・URL・永続化の直接依存は置かない
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
- playlist / analysis window の IPC 契約は `src/types/ipc/playlistWindow.ts` と `src/types/ipc/analysisWindow.ts` を正本にし、channel 名・payload 型・型ガードを main / preload / renderer で共有する
- main process の sender 検証は `electron/src/ipc/windowSenderGuards.ts` を共通利用し、`BrowserWindow.fromWebContents(...)` で live な sender window を確認する

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
- playlist / analysis window の公開面は `window.electronAPI.playlist` / `window.electronAPI.analysis` に閉じ込め、top-level に window 専用イベント API を増やさない
- settings の正規化は `src/types/settings/normalizers.ts` の `normalizeAppSettings` を正本とし、main / renderer で重複実装しない
- settings 正規化の実装詳細は `src/types/settings/normalizerUtils.ts` / `dashboardNormalizers.ts` / `codingPanelNormalizers.ts` に分割し、`normalizers.ts` は facade を維持する
- playlist の共有契約は `src/types/playlist/` 配下で `core` / `window` / `api` に分割し、`src/types/Playlist.ts` は facade として維持する
- root 直下の shared type は徐々に廃止し、`src/types/analysis/`, `timeline/`, `video/`, `package/`, `playlist/`, `settings/`, `ipc/` のようにユースケース単位で配置する
- `analysis/core.ts` のような抽象名は避け、`view.ts`, `momentum.ts`, `matrix.ts` のように実際の概念名で分割する
- preload は outbound / inbound の両方向で payload guard を通し、無効 payload を main / renderer に流さない
- menu 系の preload listener も typed listener store を使って cleanup 可能な登録 API に揃え、`removeAllListeners` 前提の singleton listener を置かない
- ローカルファイル読込で `fetch(filePath)` は使用しない
  - `readJsonFile`
  - `readTextFile`
  - `readBinaryFile`

## 主要データモデル

- `TimelineData` は `labels` 中心モデル
- 旧フィールド `actionType` / `actionResult` は型から削除
- 旧データは読込時にマイグレーションし、保存時は新形式のみ出力
- `AnalysisView` など analysis 系 shared contract は `src/types/analysis/` 配下を正本にし、root の `src/types/AnalysisView.ts` は互換 facade として扱う
- playlist 同期は `PlaylistSyncData` を正とし、playlist 画面・hooks の契約を統一
- playlist / analysis window まわりの renderer 側直接依存は gateway に閉じ込め、`src/features/playlist/gateway/playlistWindowGateway.ts` と `src/features/videoPlayer/app/gateways/analysisWindowGateway.ts` を入口に統一する
- timeline import/export は `src/features/videoPlayer/app/gateways/timelineImportExportGateway.ts` と `src/features/videoPlayer/app/utils/timelineImportExportService.ts` に分離し、menu 購読・file dialog・serialize/deserialize を hook に同居させない
- clip export は `src/shared/clipExport/` に型・gateway・pure service を集約し、playlist / timeline 側では clip builder と UI state だけを持つ
- analysis dashboard import/export は `analysisDashboardGateway.ts` と `analysisDashboardImportExportService.ts` に分離し、controller に JSON parse / dialog / read-write を同居させない
- Video.js 参照は `src/features/videoPlayer/shared/videojs/videoJsAdapter.ts` に集約し、feature 内に `videojs as unknown as ...` を散在させない
- playlist window の同期 hook は IPC 登録・open state 監視・window open を gateway helper に分離し、hook 本体では state 適用だけを扱う
- playlist window の runtime は `data runtime` と `interaction runtime` に分け、state 合成と playback/hotkey 合成を分離する
- プレイリスト追加は `src/features/playlist` の公開 API に集約し、renderer からの個別 IPC 呼び出しを分散させない
- 音声同期の相関解析は `src/utils/audioSync/` 配下で stage helper に分割し、探索ロジックと orchestration を分離する
- event insights の shared domain は facade と builder 群に分け、summary/stat family ごとの集計責務を分離する
- `src/App.tsx` は app shell view switch のみを持ち、hash / Electron shell event / external open は `src/hooks/useAppShellController.ts` に閉じ込める
- recent packages は state hook と storage/menu gateway を分離し、`localStorage` と Electron menu sync を hook 本体へ直書きしない

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
- 長期的な設計判断は `docs/adr/` に ADR として記録
- ディレクトリ構成と配置判断は `docs/project-structure.md` を更新
