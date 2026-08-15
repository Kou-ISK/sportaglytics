# SporTagLytics System Overview

SporTagLytics の現行アーキテクチャ概要です。詳細規約は `AGENTS.md` を正とし、本書は実装トレース用の要約に限定します。

関連する入口:

- [ドキュメント索引](README.md)
- [ドキュメント運用ガイド](documentation-guide.md)
- [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix)
- [プロジェクト構成](project-structure.md)
- [ADR](adr/README.md)
- [Testing and Quality Gates](testing.md)
- [Privacy and Data Handling](privacy-and-data-handling.md)

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
  - `electron/src/preload/timelineWindowBridge.ts`
- Electronの型検査は`electron/tsconfig.json`（no emit）、main process生成は`electron/tsconfig.build.json`、sandbox preload生成は`vite.preload.config.ts`に分離する。preload bundleの生成後に品質ゲートを実行しても、main process用TypeScript emitが`build/electron/src/preload.js`を上書きしない（ADR: [0002](adr/0002-typed-electron-ipc-and-renderer-gateways.md)）
- playlist / analysis / coding panel / timeline window の IPC 契約は `src/types/ipc/playlistWindow.ts`、`src/types/ipc/analysisWindow.ts`、`src/types/ipc/codingPanelWindow.ts`、`src/types/ipc/timelineWindow.ts` を正本にし、channel 名・payload 型・型ガードを main / preload / renderer で共有する（ADR: [0008](adr/0008-dedicated-sub-window-runtime-and-synchronization.md)、[0021](adr/0021-detached-timeline-playback-authority.md)）
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

配布版のFFmpeg/FFprobeは、固定SHA-256で検証したFFmpeg 8.1.2 sourceからmacOSのCPU architectureごとにbuildします。npmのprebuilt binaryへ依存せず、配布版は`Resources/media-tools`以外へfallbackしません。FFprobeは30秒・1 MiB、長時間のFFmpeg処理も有限時間・有限出力で実行し、上限超過時はchild processを終了します（ADR: [0020](adr/0020-verified-media-toolchain-and-process-containment.md)）。

## Renderer API 方針

- Renderer は `window.electronAPI` のみを利用
- 汎用 `on/off/send` は廃止し、用途別の明示 API に統一
- playlist / analysis / coding panel / timeline window の公開面は `window.electronAPI.playlist` / `window.electronAPI.analysis` / `window.electronAPI.codingPanelWindow` / `window.electronAPI.timelineWindow` に閉じ込め、top-level に window 専用イベント API を増やさない
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
- パッケージ作成の複数映像選択は、明示 API `openVideoFiles(): Promise<string[]>` と `files:open-video-files` IPC に閉じ込める。Renderer の Controller が結果を選択順で state へ反映し、描画専用 View は Electron API に依存しない

## 主要データモデル

- package media は `.metadata/config.json` の `angles[] -> clips[]` と各クリップの `timelineStartSeconds` を正本とし、最大8アングル・各16クリップを扱う。ローカル映像も元クリップを仮想タイムライン上で切り替え、空白は再生時に黒画面・無音として扱う。`packageClipTimelineService.ts` はconfigだけを原子的に更新し、書き出し時だけ一時領域へ連続映像を合成する。`gapBeforeSeconds` は後方互換の派生値である（ADR: [0015](adr/0015-clip-timeline-placement-and-audio-assisted-sync.md)）
- アングル単位の再生補正は `.metadata/config.json` の `syncData.angleOffsets[]` を正本とし、アングルindexごとに `globalTime + offset` を適用する。`syncOffset` は配列要素がない旧パッケージの後方互換値として維持する（ADR: [0016](adr/0016-multi-angle-audio-sync-offset-persistence.md)）
- YouTube 埋め込みは shared のアプリ識別 URL を Video.js の `widget_referrer` と YouTube `/embed/` リクエストの Referer に使用する。`file://` と不一致になる HTTPS `origin` parameter は指定せず、IFrame API の共通再生制御を維持する。main process の `youtubeEmbedIdentity.ts` が Session 単位で対象リクエストだけを補正し、証明書検証と `webSecurity` は維持する（ADR: [0014](adr/0014-youtube-embed-client-identity.md)）
- 複数クリップまたは先頭空白を持つローカル・YouTubeアングルは、共通タイムライン時計から現在クリップとクリップ内時刻を解決する。既知のクリップ終了から次の開始位置まではプレイヤーを外して黒表示を維持し、共通コントローラーとホットキーはタイムライン時計を操作する
- 連続逆再生はHTML Mediaの負の `playbackRate` に依存せず、共通の `useContinuousReversePlayback` が経過時間に応じてタイムライン時計を戻す。メイン映像、分離タイムライン、コードウィンドウ、プレイリストのどこにフォーカスがあっても同じhotkey commandを開始・停止し、blur時には押下状態を解除する
- `tightViewPath` / `wideViewPath` だけの旧パッケージは、ロード前のconfig migrationで1アングル1クリップの `angles[].clips[]` へ移行する。`angles[].clips` とアングル単位の再生用コピーが併存する形式は、互換パスを元クリップ参照へ切り替える。既存映像の自動削除は行わず、重複ファイルの整理は内容一致を確認した明示的な移行作業とする
- パッケージ作成は基本情報・映像の2ステップとし、保存先は作成時に選択する。各アングルの「＋」から映像種別を選択し、同期位置は作成画面では扱わず再生画面のシンクモードへ集約する
- `tightViewPath` / `wideViewPath` は旧パッケージ互換の派生フィールドであり、新規処理は `angles[]` を優先する
- `TimelineData` は `labels` 中心モデル
- 旧フィールド `actionType` / `actionResult` は型から削除
- 旧データは読込時に `Type` / `Result` ラベルへマイグレーションし、保存時は新形式のみ出力
- `AnalysisView` など analysis 系 shared contract は `src/types/analysis/` 配下を正本にし、root の `src/types/AnalysisView.ts` は互換 facade として扱う
- playlist 同期は `PlaylistSyncData` を正とし、playlist 画面・hooks の契約を統一
- playlist / analysis / coding panel window まわりの renderer 側直接依存は gateway に閉じ込め、`src/features/playlist/gateway/playlistWindowGateway.ts`、`src/features/videoPlayer/app/gateways/analysisWindowGateway.ts`、`src/features/videoPlayer/components/Controls/gateways/codingPanelWindowGateway.ts` を入口に統一する
- timeline import/export は `src/features/videoPlayer/app/gateways/timelineImportExportGateway.ts` と `src/features/videoPlayer/app/utils/timelineImportExportService.ts` に分離し、menu 購読・file dialog・serialize/deserialize を hook に同居させない（ADR: [0009](adr/0009-timeline-import-export-interoperability.md)）
- package内の `timeline.json` はversion 2で `rows[]` と `instances[]` を分離し、名称・色・順序は行が所有する。旧配列形式はロード時に行を導出し、編集されるまで書き換えない。行の選択・並べ替え・削除、通常ドラッグによるインスタンス移動、`Option`ドラッグまたは`Command+C/V`による行間コピーをサポートする（ADR: [0017](adr/0017-row-owned-timeline-presentation.md)）
- clip export は `src/shared/clipExport/` に型・gateway・pure service を集約し、playlist / timeline 側では clip builder と UI state だけを持つ（ADR: [0010](adr/0010-ffmpeg-clip-export-execution-boundary.md)）
- clip export の実行進捗は `electron/src/exportProgressWindow.ts` と `src/types/ipc/exportProgressWindow.ts` を境界にし、main 側で FFmpeg の `out_time` を工程durationに対する割合へ変換して専用進捗ウィンドウへ送信する。進捗ウィンドウは非モーダルかつ更新時にactivateせず、playlist / timeline 側は `progressId` を渡した後もメイン画面の操作を継続できる（ADR: [0010](adr/0010-ffmpeg-clip-export-execution-boundary.md)）
- analysis dashboard import/export は `analysisDashboardGateway.ts` と `analysisDashboardImportExportService.ts` に分離し、controller に JSON parse / dialog / read-write を同居させない（ADR: [0011](adr/0011-dashboard-widget-system-and-analysis-consolidation.md)）
- analysis report export は `src/report/` と `src/features/analysisReport/` に分離し、PDF 出力境界は [analysis-report.md](analysis-report.md) に従う
- Video.js 参照は `src/features/videoPlayer/shared/videojs/videoJsAdapter.ts` に集約し、feature 内に `videojs as unknown as ...` を散在させない
- playlist window の同期 hook は IPC 登録・open state 監視・window open を gateway helper に分離し、hook 本体では state 適用だけを扱う
- playlist window の runtime は `data runtime` と `interaction runtime` に分け、state 合成と playback/hotkey 合成を分離する
- プレイリスト追加は `src/features/playlist` の公開 API に集約し、renderer からの個別 IPC 呼び出しを分散させない
- coding panel window は表示状態 sync とクリック command のみを扱い、タグ付け時刻・押下状態・タイムライン更新はメイン動画ウィンドウの `EnhancedCodePanel` controller で確定する
- timeline window は document/選択の snapshot、高頻度かつ固定サイズの playback clock、編集 command を分離し、Video.js player、再生時計、タイムライン document、Undo/Redo 履歴はメイン動画ウィンドウを唯一の authority とする。再生ヘッドは短い clock 間を compositor-friendly な linear transition で補間し、シーク入力はフレーム単位で main runtime へ集約する（ADR: [0021](adr/0021-detached-timeline-playback-authority.md)）
- coding panel window のsync/command IPCは各channelにつきrenderer subscriberを1つに限定する。contextBridge越しのcallback同一性へ解除を依存させず、再購読時に従来のwrapped listenerを除去する
- 新規コードウィンドウのメニュー要求は `menu-create-code-window-file` / `onCreateCodeWindowFile()` の専用契約でメイン動画ウィンドウの runtime controller へ渡す。controllerは空の `.stcw` を保存し、ファイルパスと layout を独立 coding panel window へ同期する
- メニューはドキュメント指向で分類し、映像パッケージとコードウィンドウの作成・選択は「ファイル」、既存ウィンドウ管理は「ウィンドウ」に限定する。コード／ラベル／編集モードは対象のコードウィンドウ内だけで変更し、対象を選ばない表示・モード変更経路は持たない（ADR: [0019](adr/0019-code-window-owned-modes-and-direct-visual-editing.md)）
- 映像パッケージ作成のメニュー要求は `menu-create-video-package` / `onCreateVideoPackage()` をgateway経由で動画プレイヤーcontrollerへ渡し、現在の映像表示を終了して作成ウィザードを開く
- coding panel window の編集モードは別ウィンドウ内で動作し、編集 UI は `CodingPanelWindowEditPane` に分離する。ボタン詳細編集は右側常設ペインではなく Inspector ダイアログで表示する。layout 更新と `.stcw` 保存要求は command としてメイン動画ウィンドウ側 controller に戻し、runtime layout / file path を controller が保持する
- coding panel window の実行・編集ボタンは `src/components/ui/composites/CodeWindowButtonSurface.tsx` を共有し、編集時は選択状態とhandleだけを追加する。ウィンドウresizeは保存キャンバス寸法を変更しない
- 音声同期の相関解析は `src/utils/audioSync/` 配下で stage helper に分割し、探索ロジックと orchestration を分離する。offset contract は ADR: [0016](adr/0016-multi-angle-audio-sync-offset-persistence.md) に従う
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
- 実装変更時の docs 同期は `docs/documentation-guide.md` の Docs Impact Matrix に従う
