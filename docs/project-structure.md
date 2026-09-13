# Project Structure

このドキュメントは SporTagLytics のディレクトリ構成と配置判断ルールです。アーキテクチャ規約の正本は `AGENTS.md`、現行アーキテクチャ要約は [system-overview.md](system-overview.md) です。本書は「新しいファイルをどこに置くか」を判断するための実務ガイドです。

## Top-Level Layout

| Path         | Role                                           | Placement rule                                                            |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `.github/`   | GitHub workflows / templates / AI instructions | GitHub上の運用・CI・Copilot指示                                           |
| `docs/`      | user / developer / architecture docs           | 仕様、ADR、配布・運用手順。新規docsは`docs/README.md`へ掲載               |
| `electron/`  | Electron main / preload                        | Node/Electron API、IPC、BrowserWindow、local process管理                  |
| `public/`    | static bundled assets                          | icon、static template、同梱assets。大型modelはgit管理しない               |
| `resources/` | optional packaged runtime assets               | release/local build時に注入するruntime asset。model binaryはgit管理しない |
| `scripts/`   | repo-level automation                          | architecture/preload/ADR check、report、E2E                               |
| `src/`       | React renderer                                 | UI、feature、shared domain、shared type。Electron direct import禁止       |
| root         | package/config/community entry                 | package.json、TS/Vite/ESLint、README、LICENSE等                           |

Model training / evaluation / dataset preparationはSporTagLytics repositoryの責務ではありません。別private R&D repositoryで管理し、public appにはmodel packのconsumer contractだけを置きます。

`electron/src/packageSessionRegistry.ts` はpackage単位のMain Windowと補助Windowの所有関係を管理するmain-processの共有基盤です。OS由来のpackage openは `packageOpenQueue.ts` と `packageOpenRouter.ts` に置き、Window生成やElectron APIへの依存を持たないルーティング規則をテスト可能に保ちます。

### Optional runtime resource staging

```text
resources/
└── event-detection-models/
    └── .gitkeep
```

`resources/event-detection-models/` はsanitized deployable model packをbuild時に一時配置するstaging pointです。`.gitignore`は`.gitkeep`以外を除外し、`electron-builder`がstaged contentをpackaged appの`event-detection-models`へ配置します。model binary、checkpoint、private manifestをsource treeへcommitしません。

## Renderer Layout

依存方向は `pages -> features -> shared` です。

| Path                      | Role                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `src/pages/`              | routing / entry composition only                                 |
| `src/features/<feature>/` | feature固有 Screen / Controller / Hook / View / Gateway / domain |
| `src/components/ui/`      | feature非依存 shared UI primitives / composites / patterns       |
| `src/design-system/`      | foundation / semantic token、MUI theme、Storybook token story    |
| `src/components/`         | legacy/shared UI                                                 |
| `src/hooks/`              | truly shared hooks                                               |
| `src/contexts/`           | app-wide context only                                            |
| `src/shared/`             | shared domain/service/contract                                   |
| `src/types/`              | shared type contracts                                            |
| `src/report/`             | report DTO / renderer-independent report contracts               |

### Feature placement rule

新しい機能は原則:

```text
src/features/<feature>/
├── index.ts
├── <Feature>Screen.tsx
├── components/
│   └── <Feature>View.tsx
├── hooks/
├── controllers/
├── gateway/
├── domain/
└── testing/
```

全featureが全folderを持つ必要はありません。外部依存・UI描画・domain計算の責務が混ざらないことを優先します。

Feature外から参照する場合は `src/features/<feature>/index.ts` を公開面にします。

## 起動画面とヘルプの配置

開始画面は `src/features/videoPlayer/components/Setup/` に置きます。`VideoPathSelectorView` はprops-onlyな構成、配下のcomponentsは履歴行・開始操作・状態表示、hooksは入力とロード購読、gatewayはIPC・永続化を担当します。開く要求の状態は `useStartPackageOpen` に集約します。詳細は[起動画面](start-workspace.md)。

Paintの操作・位置キー・追尾は `src/features/playlist/studio/`、共通の注釈計算は `src/shared/tactics/` に置きます。[Paintの実装入口](tactics.md#実装と検証の入口)を参照してください。アプリ内ヘルプの本文・HTML生成は `electron/src/helpDocument.ts`、BrowserWindowとセキュリティ設定は `electron/src/helpWindow.ts` に分離します。

## Video Player Feature

Video runtimeは `src/features/videoPlayer/` にまとまります。

```text
src/features/videoPlayer/
├── app/                         # main video Screen/runtime composition
├── analysis/                    # renderer-side statistics/domain
├── components/                  # player/coding/analysis feature UI
├── eventDetection/              # automatic event coding
│   ├── components/
│   │   ├── EventDetectionDialogView.tsx
│   │   └── EventDetectionDialogView.test.tsx
│   ├── hooks/
│   │   └── useEventDetectionController.ts
│   ├── gateway/
│   │   └── eventDetectionGateway.ts
│   └── domain/
│       ├── candidatesToTimeline.ts
│       ├── candidatesToTimeline.test.ts
│       ├── eventDetectionMappings.ts
│       └── eventDetectionMappings.test.ts
└── shared/
```

`eventDetection` を別app/pageへしない理由は、検出結果を確定するTimeline authorityがmain video runtimeにあり、結果を通常Timelineへ直接追加するためです。モデル実行自体はElectron側へ分離します。

## Coding Range Domain

手動Codingと自動Codingで共通のrange計算:

```text
src/features/videoPlayer/components/Controls/domain/
├── recordingRange.ts
└── recordingRange.test.ts
```

`recordingRange.ts` はReact/Electron非依存のpure domain functionです。

Code Windowの保存型は:

```text
src/types/settings/
├── coreTypes.ts
├── codingPanelNormalizers.ts
└── ...
```

`leadTimeSeconds` / `lagTimeSeconds` のmigration/validationは `codingPanelNormalizers.ts` で行います。

## Shared Event Detection Contracts

```text
src/types/eventDetection/
└── core.ts

src/types/ipc/
├── eventDetection.ts
└── eventDetection.test.ts

src/shared/eventDetection/
├── modelQualityGate.ts
└── modelQualityGate.test.ts
```

役割:

- `types/eventDetection/core.ts`: model/event/request/result/mappingのrenderer-main共有domain型。model statusは`verified | experimental`
- `types/ipc/eventDetection.ts`: channel、preload API、payload/model metadata guard
- `shared/eventDetection/modelQualityGate.ts`: verified model packのminimum runtime gate

ML framework固有typeやtraining/evaluation codeはここへ置きません。ONNX/PyTorch等はrunnerまたは外部R&Dの実装詳細です。

## Electron Layout

```text
electron/src/
├── main.ts
├── ipc/
├── preload/
├── menu/
├── eventDetection/
├── llama/
├── mediaTools/
└── *Window.ts
```

### Event Detection Main Process

```text
electron/src/eventDetection/
├── eventDetectionManager.ts
├── modelDiscovery.ts
├── modelDiscovery.test.ts
├── processRunner.ts
├── requestRegistry.ts
└── types.ts

electron/src/ipc/
└── eventDetectionHandlers.ts

electron/src/preload/
└── eventDetectionBridge.ts
```

責務:

- `modelDiscovery`: status-aware manifest / event eligibility / platform runner / SHA-256検証
- `eventDetectionManager`: runnable model解決とrequest support確認
- `processRunner`: bounded child process execution
- `requestRegistry`: cancel対象process管理
- `eventDetectionHandlers`: sender/payload validation
- `eventDetectionBridge`: rendererへ用途限定API公開

Rendererから `child_process`, filesystem, ML runtimeを直接使用しません。

## Timeline Contracts

```text
src/types/timeline/
├── core.ts
└── ...
```

- `TimelineData`: persisted instance
- `TimelineRow`: row-owned name/color/order
- `TimelineDocument`: versioned rows + instances
- `NewTimelineData`: id採番前のbulk insert input

Timeline編集runtime:

```text
src/features/videoPlayer/app/hooks/
├── useTimelineEditing.ts
├── useTimelineHistory.ts
├── useTimelinePersistence.ts
└── useTimelineSessionController.ts
```

複数eventの自動追加は `addTimelineDatas()` で1回のstate updateにします。

## Dedicated Windows

Window-specific BrowserWindow / IPC contractはmainとshared typeを分けます。

| Window          | Main                                   | Shared IPC contract                     |
| --------------- | -------------------------------------- | --------------------------------------- |
| Analysis        | `electron/src/analysisWindow.ts`       | `src/types/ipc/analysisWindow.ts`       |
| Coding Panel    | `electron/src/codingPanelWindow.ts`    | `src/types/ipc/codingPanelWindow.ts`    |
| Timeline        | `electron/src/timelineWindow.ts`       | `src/types/ipc/timelineWindow.ts`       |
| Playlist        | `electron/src/playlistWindow.ts`       | playlist IPC contracts                  |
| Export Progress | `electron/src/exportProgressWindow.ts` | `src/types/ipc/exportProgressWindow.ts` |

## Scripts

Repo全体へ作用する検査・report・E2Eは `scripts/` です。

代表例:

```text
scripts/
├── check-architecture.js
├── check-adr.js
├── check-preload-bundle.js
├── report-architecture-health.js
├── report-large-files.js
└── e2e-*.mjs
```

Model training/evaluation用scriptはここへ置きません。

## External Model R&D Boundary

SporTagLyticsはevent modelの**consumer**です。別private R&D repositoryが、dataset preparation、training、benchmark、qualification、model exportを担当します。

Public repositoryへ持ち込めるもの:

- model pack schema / runtime contract
- verified/experimental status contract
- compatibility/quality metadata contract
- synthetic fixtureを使ったruntime test
- ignored staging directory

Public repositoryへ持ち込まないもの:

- 元動画 / `.stpkg` / Coding dataset
- source-identifying manifest/path
- frames / checkpoints / training runs
- deployable model binary
- model family比較やfine-tuning script
- private diagnostic output

詳細は [ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md) と [ADR 0024](adr/0024-experimental-event-detection-production-lane.md) を正とします。

## Documentation Placement

```text
docs/
├── README.md
├── user-guide.md
├── development.md
├── testing.md
├── system-overview.md
├── project-structure.md
├── event-detection.md
└── adr/
```

長期判断を新規追加・変更する場合はADRへ記録します。自動イベント検出のR&D分離はADR 0023、experimental production laneはADR 0024を正とします。

## Placement Checklist

新規ファイル追加前に確認:

1. feature固有かsharedか、または外部R&Dの責務か。
2. UI描画と外部依存が分離されているか。
3. Viewから `window.electronAPI` を呼んでいないか。
4. feature外参照が `index.ts` 経由か。
5. Electron APIはmain/preload/gateway境界内か。
6. IPC contractは `src/types/ipc/` にあるか。
7. pure domain logicをHook/Viewへ埋め込んでいないか。
8. ML学習・評価コードやdeployable model binaryをSporTagLytics runtime repositoryへ戻していないか。
9. 新しい設計判断ならADR/docs indexを更新したか。

### 作業画面のStorybook

feature固有の `*.stories.tsx` は対象のprops-only Viewと同じディレクトリに配置する。共通controlの比較は `src/design-system/stories/Controls.stories.tsx`、開始画面は `VideoPathSelectorView.stories.tsx` が入口となる。

### Playlist Paint

`src/features/playlist/studio/` は描画gesture/editor hook、Playlist runtime adapter、描画ツール・プロパティ・レイヤー・transport・clip Viewを配置する。`components/annotationDrawing.ts` は編集とPNG出力で共通の描画処理。`fixtures/studio.ts` はStorybookとテスト専用データ。外部依存は既存Playlist controller/gatewayに閉じ込める。

- `src/components/ui/composites/MovieTransportView.tsx`: 映像featureに依存しないジョグ式再生操作View。
- `src/features/playlist/components/tacticalDrawing.ts`: 編集とPNG出力が共用する戦術図形renderer。
- `src/features/playlist/studio/StudioCoachView.tsx`: Coach表示用の描画操作View。

- `src/shared/tactics/`: 時間補間、キー簡略化、平面射影、芝色処理、注釈検証の純粋計算。
- `src/features/playlist/studio/tracking/`: 動画フレーム読取・テンプレート追跡・結果適用hook。
- `src/features/playlist/studio/Tactics*View.tsx` / `PitchCalibration*View.tsx`: props-onlyの区間・追跡・較正・プリセットUI。
- `src/features/playlist/studio/tacticsPreferencesGateway.ts`: 端末設定の読込検証と保存。
- `electron/src/ipc/exportMotionOverlays.ts` / `exportChroma.ts`: 検証済みの動画描画を静止挿入前のFFmpeg filterへ変換。

利用者向けの名称はPaint。`studio/` と既存内部モード値は互換性のため維持する。

`src/design-system/mediaChrome.ts` は動画に接する操作面の共通スタイル。`tokens/semantic.ts` のmediaトークンだけを消費し、再生状態やfeature依存を持たない。

`src/shared/hooks/useVideoWindowAspect.ts` は映像のメタデータと表示領域をOSのウィンドウ寸法へ接続する共通Hook。描画専用Viewは寸法制約やIPCを持たない。

`useStudioRulerInput` が連続入力のフレーム単位の集約を担当する。`StudioTimeRulerView` は目盛りとネイティブシーク入力のみを描画し、TacticsTimelineViewがレイヤーと共通再生線へ合成する。

Paint trackingのfeatureTrackerは複数点の往復照合と変位の合意、trackingAnchorは初期点/再探索、trackAnnotationはフレーム読込とキーフレーム出力を担当する。PlaylistはuseVideoWindowAspectを利用しない。

PaintのlinkedDiscLayoutは選手リンクの配置計算、StudioPlayerCountViewは人数ドロップダウンを担当する。components/discDrawingは映像用ディスクの材質描画を共有する。tracking/framePyramidは追尾再探索用の縮小画像を生成する。いずれも外部依存を持たない。

StudioInspectorHeaderViewはPaint編集パネルの開閉と履歴操作のみを描画する。開閉状態はuseStudioEditor、本文と幅の切替はStudioSidebarViewが担当する。studioControlLayoutはPaint内の操作ラベルを一行に保つ共通レイアウト規則で、操作群の改行は各Viewが担当する。

Paintの数値入力は `studio/StudioNumberFieldView.tsx` が入力中のdraftだけを持ち、確定callbackで `useStudioKeyframes` に渡します。保存とキーの順序制約をViewへ持ち込みません。

## プラットフォーム配布

`scripts/media-tools/` は共通source pin・process runnerとmacOS/Windowsのビルド手順を分割する。`scripts/prepare-mac-llama.mjs` はMac CPU別の検証済みAI実行ファイルを `.cache/llama/darwin-<arch>` へ配置する。`scripts/windows/` はNSIS拡張・Windowsネイティブ依存検査・インストール試験。生成物は `.cache/`、配布物は `dist/` に置きgitへ追加しない。機能ViewへOS分岐を散らさず `src/utils/platformShortcut.ts` とElectronの境界で吸収する。
