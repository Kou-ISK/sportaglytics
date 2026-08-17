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
- [自動イベント検出](event-detection.md)

## レイヤー構成

- 依存方向: `pages -> features -> shared`
- `pages` はルーティングと feature 合成のみ担当
- `features` は `Screen / Controller(or Hook) / View / Gateway / domain` を機能単位で内包
- shared 相当は `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`, `src/shared`, `src/report`
- feature 外から feature を参照する場合は `src/features/<feature>/index.ts` の公開 API のみ利用
- Electron、URL、永続化、OS file dialog などの外部依存は Gateway / Controller / Hook に閉じ込める
- Storybook 対象は描画専用 `View` と `src/components/ui`。View は `window.electronAPI` を直接使用しない
- Atomic Design はアプリ全体のフォルダ規約ではなく、shared UI 設計時のメンタルモデルとしてのみ利用

## Electron 構成

### Main process

`electron/src/main.ts` は起動と各handler/windowの組み立てに集中します。実処理はドメインごとに分割します。

代表例:

- `electron/src/ipc/fileHandlers.ts`
- `electron/src/ipc/reportHandlers.ts`
- `electron/src/ipc/dashboardHandlers.ts`
- `electron/src/ipc/codeWindowHandlers.ts`
- `electron/src/ipc/exportHandlers.ts`
- `electron/src/ipc/llamaHandlers.ts`
- `electron/src/ipc/eventDetectionHandlers.ts`

Window runtime:

- `electron/src/analysisWindow.ts`
- `electron/src/codingPanelWindow.ts`
- `electron/src/playlistWindow.ts`
- `electron/src/timelineWindow.ts`
- `electron/src/settingsWindow.ts`
- `electron/src/exportProgressWindow.ts`

### Preload

`electron/src/preload.ts` は用途別bridgeを合成します。

- `appBridge.ts`
- `eventBridge.ts`
- `settingsBridge.ts`
- `analysisBridge.ts`
- `playlistBridge.ts`
- `codeWindowBridge.ts`
- `codingPanelWindowBridge.ts`
- `timelineWindowBridge.ts`
- `eventDetectionBridge.ts`

Renderer は `window.electronAPI` のみ使用し、`electron` / `ipcRenderer` を直接 import しません。

### Typed IPC

IPC contract の正本は `src/types/ipc/` です。

- `analysisWindow.ts`
- `codingPanelWindow.ts`
- `timelineWindow.ts`
- `exportProgressWindow.ts`
- `eventDetection.ts`

Main process は sender window と payload を検証します。preload も inbound payload を guard し、汎用 `send/on/off` API は増やしません。

## BrowserWindow セキュリティ

全 BrowserWindow で以下を適用します。

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- `window.open` を拒否
- 許可されないnavigationを拒否

外部binaryはrendererから直接起動せず、main process配下のmanager/runner境界で管理します。

## パッケージ / 映像モデル

`.metadata/config.json` の `angles[] -> clips[]` を現行の映像構成正本とします。

- 最大8アングル
- 各アングル最大16クリップ
- local / YouTube source
- 各clipに `timelineStartSeconds`
- optional `durationSeconds`
- アングル単位の同期補正は `syncData.angleOffsets[]`

ローカル映像は元クリップを仮想timeline上で切り替えます。クリップ間空白は再生時に黒画面・無音で扱い、書き出し時だけ必要な一時合成を行います。

旧 `tightViewPath` / `wideViewPath` だけのpackageはロード時migrationで現行 `angles[].clips[]` へ吸収します。

関連ADR:

- [0014 YouTube Embed Client Identity](adr/0014-youtube-embed-client-identity.md)
- [0015 Clip Timeline Placement and Audio-Assisted Sync](adr/0015-clip-timeline-placement-and-audio-assisted-sync.md)
- [0016 Multi-Angle Audio Sync Offset Persistence](adr/0016-multi-angle-audio-sync-offset-persistence.md)

## Playback authority と分離Timeline

Video.js player、再生時計、Timeline document、Undo/Redo履歴はメイン動画windowを唯一のauthorityとします。

Timelineはsingletonの専用BrowserWindowです。

- packageを開いた時に自動表示
- 閉じた後は `ウィンドウ > タイムラインを表示` で再表示
- 映像面に常設の「タイムラインを表示」overlay buttonは置かない
- document/selection sync、高頻度clock sync、編集commandを別payloadにする
- Timeline window側のhotkey commandもmain video runtimeへ戻す

関連ADR: [0021 Detached Timeline and Playback Authority](adr/0021-detached-timeline-playback-authority.md)

## Timeline model

`timeline.json` の現行formatはversion 2です。

```text
TimelineDocument
├ rows[]
└ instances[]
```

- 行が名称・色・表示順を所有
- `TimelineData` は `actionName / startTime / endTime / memo / labels / color`
- 旧 `actionType` / `actionResult` はロード時に `Type` / `Result` labelへmigration
- 保存は現行formatのみ

`NewTimelineData = Omit<TimelineData, 'id'>` を一括追加入力に使用します。`addTimelineDatas()` は複数eventを1回のstate updateで追加するため、自動Codingで多数eventを追加しても1回のUndoで戻せます。

関連ADR: [0017 Row-Owned Timeline Presentation](adr/0017-row-owned-timeline-presentation.md)

## Code Window / Coding runtime

`.stcw` は独立ドキュメントとして扱います。コード／ラベル／編集モードは対象Code Window内で切り替え、アプリ全体のmodeにはしません。

Action buttonには以下を保存できます。

```ts
leadTimeSeconds?: number;
lagTimeSeconds?: number;
```

意味:

- `leadTimeSeconds`: Action開始操作より前にTimelineへ含める秒数
- `lagTimeSeconds`: Action終了操作より後にTimelineへ含める秒数

未設定は0秒です。Button clickとhotkey codingは同じ `resolveRecordingRange()` を通ります。記録開始時にrange設定を `ActiveRecordingSession` へcopyし、記録中の設定変更でactive eventのrangeが変わらないようにします。

Activate linkのtargetはsource actionと同じ最終rangeを使用します。

関連ADR: [0019 Code-Window-Owned Modes and Direct Visual Editing](adr/0019-code-window-owned-modes-and-direct-visual-editing.md)

## 分析

分析windowの主要view:

- Dashboard
- Momentum
- Matrix
- AI Analysis

AI Analysisはローカル `llama.cpp` を使い、Timeline / labels / memo / statistics を根拠として分析文と推奨clipを生成します。映像frameそのものをLLMへ解釈させる機能ではありません。

関連ADR:

- [0005 Local LLM Analysis Boundary](adr/0005-local-llm-analysis-boundary.md)
- [0011 Dashboard Widget System and Analysis Consolidation](adr/0011-dashboard-widget-system-and-analysis-consolidation.md)
- [0012 LLM Model Artifact Distribution Boundary](adr/0012-llm-model-artifact-distribution-boundary.md)

## 自動イベント検出

自動イベント検出はLLM分析とは別のローカル映像処理です。目的は「分析判断の自動化」ではなく、通常Timelineを自動で初期Codingして手動分析開始を早めることです。

### Renderer

`src/features/videoPlayer/eventDetection/`:

- `components/EventDetectionDialogView.tsx`: props-only View
- `hooks/useEventDetectionController.ts`: model/angle選択、実行、Timeline反映
- `gateway/eventDetectionGateway.ts`: `window.electronAPI.eventDetection` のみ使用
- `domain/candidatesToTimeline.ts`: confidence filter、lead/lag、重複除外、Timeline変換

UIは `分析 > 自動イベント検出…` から開きます。検出後のeventは通常 `TimelineData` になり、専用AI Timelineやreview queueは持ちません。

### Shared contracts

- `src/types/eventDetection/core.ts`
- `src/types/ipc/eventDetection.ts`
- `src/shared/eventDetection/modelQualityGate.ts`

初期event type:

- `kickoff`
- `scrum`
- `lineout`
- `maul`
- `goalKick`

ただしproduct UIへ出るのはevent classごとの品質ゲートを通過したものだけです。

### Electron / local runner

`electron/src/eventDetection/`:

- `modelDiscovery.ts`: model pack / manifest探索
- `eventDetectionManager.ts`: verified model解決
- `processRunner.ts`: child process実行
- `requestRegistry.ts`: cancel管理
- `types.ts`: internal manifest型

Runner contract:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

制約:

- `shell: false`
- finite timeout
- bounded stderr/result size
- cancel可能
- request/result temporary fileは完了後削除
- runner executableはmanifestのSHA-256と一致必須
- path traversal拒否
- main IPC sender/payload validation

ML runtime（ONNX Runtime等）はrunner内部の実装詳細として交換可能にし、rendererを特定ML frameworkへ直接依存させません。

### Product quality gate

`verified` model packでもclass単位で以下をすべて満たす必要があります。

- Precision >= 0.95
- Recall >= 0.90
- unseen evaluation matches >= 5
- true positiveの90%以上が正解時刻±2秒以内
- 評価時 `confidenceThreshold` をmanifestへ保存

runtime thresholdは検証済みthreshold未満へ下げません。未検証modelはUIに表示しません。

評価script: `scripts/evaluate-event-detection.mjs`

詳細: [自動イベント検出](event-detection.md)、[ADR 0022](adr/0022-verified-local-rugby-event-detection.md)

## Playlist / Clip export

Playlistは独立BrowserWindowで扱い、`.stpl` documentを正本とします。Timelineからの追加とAI Analysisからの追加は共通playlist APIを利用します。

Clip exportは `src/shared/clipExport/` にpure service / contractを集約し、main processのFFmpeg runnerで実行します。進捗は専用export progress windowへ通知し、main app操作をblockしません。

配布版FFmpeg/FFprobeは固定source/hashからbuildしたverified toolchainのみ利用し、main processでtimeout/output上限を適用します。

関連ADR:

- [0008 Dedicated Sub-Window Runtime and Synchronization](adr/0008-dedicated-sub-window-runtime-and-synchronization.md)
- [0010 FFmpeg Clip Export Execution Boundary](adr/0010-ffmpeg-clip-export-execution-boundary.md)
- [0020 Verified Media Toolchain and Process Containment](adr/0020-verified-media-toolchain-and-process-containment.md)

## Persistence / migration

互換性は最新domain型へlegacy fieldを残すのではなくロード時migrationで吸収します。

- settings: `src/types/settings/normalizers.ts`
- coding panel: `src/types/settings/codingPanelNormalizers.ts`
- timeline labels: load-time migration
- package config: legacy media model migration

保存時は最新formatへ統一します。

## Quality gates

通常PRで必須:

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

ADR変更時:

```bash
pnpm run check:adr
```

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestで上記相当の検証を実行します。

自動イベント検出modelのproduction promotionは通常unit testとは別に、match-level unseen evaluationを通過する必要があります。
