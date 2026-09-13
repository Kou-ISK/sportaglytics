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
- `src/design-system/` はfoundation / semantic tokenとMUI Themeの正本、`src/components/ui/` はprops-only shared patternの配置先
- UI変更は `check:design-system` とStorybook a11y/buildで検証する

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

Packageを扱うWindowは `electron/src/packageSessionRegistry.ts` のPackage Sessionに所属する。Main Window、Timeline、Analysis、Coding Panel、Playlistはpackage単位で所有・IPC送信先を分離する。Settings、Help、Export Progressはapplication-globalとして扱う。OSからの `.stpkg` openはMain Processのキューで処理し、既存Sessionをfocusするか、空Sessionの再利用または新規Main Windowを選ぶ。

### Preload

`electron/src/preload.ts` は用途別bridgeを合成します。Renderer は `window.electronAPI` のみ使用し、`electron` / `ipcRenderer` を直接 import しません。

### Typed IPC

Rendererへ公開するIPC contractの正本は `src/renderer.d.ts` です。用途別のpayload型は `src/types/ipc/` などで定義し、公開APIから参照します。Main process は sender window と payload を検証し、preload も inbound payload を guard します。

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

## Playback authority と分離Timeline

Video.js player、再生時計、Timeline document、Undo/Redo履歴はメイン動画windowを唯一のauthorityとします。

TimelineはPackage Sessionごとに1つの専用BrowserWindowです。

- packageを開いた時に自動表示
- 閉じた後は `ウィンドウ > タイムラインを表示` で再表示
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

## Code Window / Coding runtime

`.stcw` は独立ドキュメントとして扱います。コード／ラベル／編集モードは対象Code Window内で切り替え、アプリ全体のmodeにはしません。

Action buttonには `leadTimeSeconds` / `lagTimeSeconds` を保存できます。未設定は0秒です。Button clickとhotkey codingは同じ `resolveRecordingRange()` を通ります。

## 分析

分析windowの主要view:

- Dashboard
- Momentum
- Matrix
- AI Analysis

AI Analysisはローカル `llama.cpp` を使い、Timeline / labels / memo / statistics を根拠として分析文と推奨clipを生成します。映像frameそのものをLLMへ解釈させる機能ではありません。

## 自動イベント検出

自動イベント検出はLLM分析とは別のローカル映像処理です。SporTagLyticsは**配布済みmodel packを安全に実行するconsumer**であり、model training/evaluationは別private R&D repositoryの責務です。

目的は、通常Timelineを初期Codingして手動分析開始を早めることです。実作業では高Precisionな一部候補だけを出すのではなく、**実イベントをほぼすべて候補として出し、人間が不要候補を削除する**workflowを優先します。

### Renderer

`src/features/videoPlayer/eventDetection/`:

- `components/EventDetectionDialogView.tsx`: props-only View。model status、評価値、experimental warningを表示
- `hooks/useEventDetectionController.ts`: model/angle選択、confidence設定、実行、Timeline反映
- `gateway/eventDetectionGateway.ts`: `window.electronAPI.eventDetection` のみ使用し、model listをruntime guardで再検証
- `domain/eventDetectionMappings.ts`: event mapping、manifest初期threshold、ユーザー入力の正規化
- `domain/candidatesToTimeline.ts`: confidence filter、lead/lag、重複除外、Timeline変換

UIは `分析 > 自動イベント検出…` から開きます。検出後のeventは通常 `TimelineData` になり、専用AI Timelineやreview queueは持ちません。

model statusは `verified | experimental` の2状態です。experimentalを選ぶと`試験` badge、誤検出・見逃しの警告、Recall / Precision / evaluated matches / baseline confidence thresholdを表示します。confidence thresholdは0.00〜1.00でrunごとに変更できます。

### Shared contracts

- `src/types/eventDetection/core.ts`
- `src/types/ipc/eventDetection.ts`
- `src/shared/eventDetection/modelQualityGate.ts`

初期対象event type:

- `restart`
- `scrum`
- `lineout`

`maul` / `goalKick` はshared contractには定義できますが、model packで独立に評価され、statusごとのeligibilityを満たした場合だけproduct UIへ出します。

### Electron / local runner

`electron/src/eventDetection/`:

- `modelDiscovery.ts`: model pack / manifest探索、status別eligibility、runner integrity検証
- `eventDetectionManager.ts`: runnable model解決
- `processRunner.ts`: child process実行
- `requestRegistry.ts`: cancel管理
- `types.ts`: internal manifest / runnable model型

Runner contract:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

verified/experimental共通制約:

- `shell: false`
- finite timeout
- bounded stderr/result size
- cancel可能
- request/result temporary fileは完了後削除
- runner executableはmanifestのSHA-256と一致必須
- path traversal拒否
- main IPC sender/payload validation
- renderer gatewayでmodel metadata validation

ML runtime（ONNX Runtime等）はrunner内部の実装詳細として交換可能にし、rendererを特定ML frameworkへ直接依存させません。

### Status別 eligibility

`verified` model packはclass単位で最低限以下を満たす必要があります。experimental対応でこの基準は緩和しません。

- Recall >= 0.95
- unseen evaluation matches >= 5
- Precisionは0〜1の有限値として記録
- confidence thresholdは0〜1の有限値

`experimental`はverified gate通過扱いにせず、宣言eventごとのmetricsが有効で、current platform runnerが共通セキュリティ検証を通過した場合だけ別statusのまま利用可能にします。

高Recall operating pointでのfalse positives per match、処理時間、manual edit operations、手Coding比の作業時間削減はprivate R&D qualificationで確認します。秒単位の厳密なevent onsetは主目的ではありません。

### Model pack staging

`resources/event-detection-models/` はrelease/local build用の任意staging pointです。model pack本体は`.gitignore`で除外し、`electron-builder`が存在するpackだけを`event-detection-models`へ`extraResources`として配置します。stagingが空でも通常buildは成立します。

詳細: [自動イベント検出](event-detection.md)、[ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md)、[ADR 0024](adr/0024-experimental-event-detection-production-lane.md)

## Event Model R&D boundary

SporTagLytics public repositoryには以下を置きません。

- 元動画 / `.stpkg` / Coding dataset
- dataset preparation / training / fine-tuning
- hard-negative mining
- model family比較
- threshold / NMS / stride探索
- held-out qualification
- private source diagnostics
- frames / checkpoints / runs
- deployable model binary / checkpoint

一般ユーザーPCごとの自動fine-tuningや暗黙のtraining data uploadも初期製品では行いません。

## Playlist / Clip export

Playlistは独立BrowserWindowで扱い、`.stpl` documentを正本とします。Timelineからの追加とAI Analysisからの追加は共通playlist APIを利用します。

Clip exportは `src/shared/clipExport/` にpure service / contractを集約し、main processのFFmpeg runnerで実行します。進捗は専用export progress windowへ通知し、main app操作をblockしません。

配布版FFmpeg/FFprobeは固定source/hashからbuildしたverified toolchainのみ利用し、main processでtimeout/output上限を適用します。

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

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestで上記相当の検証を実行します。Model R&DのCIはprivate repository側で管理します。

## 開始画面・再生UI・Paintの境界

UIの正本は `src/design-system/` のsemantic tokenとprops-only Viewです。開始画面の構成は `VideoPathSelector`、開く操作の単一状態源は `useStartPackageOpen`、IPCとロード時移行は `packageGateway` に置きます。初回・履歴・検索・ロード・エラーは[起動画面の仕様](start-workspace.md)を参照してください。

`MovieTransportView` は再生・送りのcallbackとラベルだけを受け取り、メイン映像・Playlist・Paintから合成します。メイン映像のウィンドウ比率は[ADR 0030](adr/0030-video-window-aspect.md)、Playlistは自由リサイズです。Timelineはrulerと行でスクロール座標を共有し、再生線を1本描画します。初期行色はアクションボタンから引き継ぎ、既存行の色は行モデルが所有します。

Timelineの `useTimelineSeek` は上部つまみだけが使用し、行の区間編集・作成と単独選択は再生時刻を更新しません。伸縮中はlane hook内でプレビューし、確定時だけ永続化・履歴へ渡します。履歴のUndo/RedoはReactの描画待ちに依存せず保存対象を同期的に返します。明示的なジャンプと再生ホットキーは既存の経路を使います。空白クリックは選択IDとフォーカス枠を同時に解除し、範囲選択直後のclickでは選択結果を消さないよう抑止します。

Paintは同じ映像DOMとPlaylist履歴を使い、Window-onlyな選択・ツール・パネル状態と、保存する注釈を分離します。`useStudioEditor` は編集の合成、`useStudioGesture` は描画ジェスチャー、`useStudioKeyframes` は位置キーの選択・時刻編集を所有します。ViewはIPC・永続化・URLを参照しません。

追尾は独立デコーダーで解析し、成功時に自動適用、部分結果は明示的に適用/破棄します。開始後の編集を古い結果で上書きしません。表示図形と独立した追尾範囲の判断は[ADR 0031](adr/0031-tracking-target-selection.md)、保存契約は[ADR 0029](adr/0029-tactics-motion-and-plane-contract.md)です。

通常再生・編集・PNGで共通レンダラーを使用し、動画出力ではソース時刻上のmotion overlayとアングル別の芝色処理を静止挿入より前に合成します。[Paint仕様](tactics.md)に型・上限・実装入口を、[Playlist仕様](playlist-features.md)に文書・順序・Sessionをまとめます。

## Windowsの実行境界

[Windows版](windows.md)と[ADR 0033](adr/0033-windows-desktop-runtime.md)に従い、描画・保存・追尾は共通実装、OS差分はElectronの映像処理・縦横比・loopback音声とshared shortcutへ集約する。file URLはNodeの変換またはパス成分のエンコードを通し、Windowsドライブや予約文字を壊さない。
