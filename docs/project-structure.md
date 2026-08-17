# Project Structure

このドキュメントは SporTagLytics のディレクトリ構成と配置判断ルールです。アーキテクチャ規約の正本は `AGENTS.md`、現行アーキテクチャ要約は [system-overview.md](system-overview.md) です。本書は「新しいファイルをどこに置くか」を判断するための実務ガイドです。

## Top-Level Layout

| Path | Role | Placement rule |
| --- | --- | --- |
| `.github/` | GitHub workflows / templates / AI instructions | GitHub上の運用・CI・Copilot指示 |
| `docs/` | user / developer / architecture docs | 仕様、ADR、配布・運用手順。新規docsは`docs/README.md`へ掲載 |
| `electron/` | Electron main / preload | Node/Electron API、IPC、BrowserWindow、local process管理 |
| `public/` | static bundled assets | icon、static template、同梱assets。大型modelはgit管理しない |
| `research/` | offline model research | 学習・ベンチマーク・dataset manifest生成。アプリruntimeへ直接importしない |
| `resources/` | optional packaged runtime assets | 検証済みruntime/model pack等。配布工程で用意するasset |
| `scripts/` | repo-level automation | architecture/preload/ADR check、evaluation、report、E2E |
| `src/` | React renderer | UI、feature、shared domain、shared type。Electron direct import禁止 |
| root | package/config/community entry | package.json、TS/Vite/ESLint、README、LICENSE等 |

## Renderer Layout

依存方向は `pages -> features -> shared` です。

| Path | Role |
| --- | --- |
| `src/pages/` | routing / entry composition only |
| `src/features/<feature>/` | feature固有 Screen / Controller / Hook / View / Gateway / domain |
| `src/components/ui/` | feature非依存 shared UI primitives / composites / patterns |
| `src/components/` | legacy/shared UI |
| `src/hooks/` | truly shared hooks |
| `src/contexts/` | app-wide context only |
| `src/shared/` | shared domain/service/contract |
| `src/types/` | shared type contracts |
| `src/report/` | report DTO / renderer-independent report contracts |

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

## Video Player Feature

Video runtimeは `src/features/videoPlayer/` にまとまります。

```text
src/features/videoPlayer/
├── app/                         # main video Screen/runtime composition
├── analysis/                    # renderer-side statistics/domain
├── components/                  # player/coding/analysis feature UI
├── eventDetection/              # verified automatic event coding
│   ├── components/
│   │   └── EventDetectionDialogView.tsx
│   ├── hooks/
│   │   └── useEventDetectionController.ts
│   ├── gateway/
│   │   └── eventDetectionGateway.ts
│   └── domain/
│       ├── candidatesToTimeline.ts
│       └── candidatesToTimeline.test.ts
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
└── eventDetection.ts

src/shared/eventDetection/
├── modelQualityGate.ts
└── modelQualityGate.test.ts
```

役割:

- `types/eventDetection/core.ts`: model/event/request/result/mappingのrenderer-main共有domain型
- `types/ipc/eventDetection.ts`: channel、preload API、payload guard
- `shared/eventDetection/modelQualityGate.ts`: product promotion gateのpure判定

ML framework固有typeはここへ置きません。ONNX/PyTorch等はrunner内部の実装詳細です。

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
├── processRunner.ts
├── requestRegistry.ts
└── types.ts

electron/src/ipc/
└── eventDetectionHandlers.ts

electron/src/preload/
└── eventDetectionBridge.ts
```

責務:

- `modelDiscovery`: verified manifest / event quality / platform runner / SHA-256検証
- `eventDetectionManager`: model解決とrequest support確認
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

| Window | Main | Shared IPC contract |
| --- | --- | --- |
| Analysis | `electron/src/analysisWindow.ts` | `src/types/ipc/analysisWindow.ts` |
| Coding Panel | `electron/src/codingPanelWindow.ts` | `src/types/ipc/codingPanelWindow.ts` |
| Timeline | `electron/src/timelineWindow.ts` | `src/types/ipc/timelineWindow.ts` |
| Playlist | `electron/src/playlistWindow.ts` | playlist IPC contracts |
| Export Progress | `electron/src/exportProgressWindow.ts` | `src/types/ipc/exportProgressWindow.ts` |

## Scripts

Repo全体へ作用する検査・評価は `scripts/` です。

代表例:

```text
scripts/
├── check-architecture.js
├── check-adr.js
├── check-preload-bundle.js
├── report-architecture-health.js
├── report-large-files.js
├── evaluate-event-detection.mjs
└── e2e-*.mjs
```

`evaluate-event-detection.mjs` はmatch-level unseen ground truthとpredictionを比較し、verified model manifestへ転記可能なclass別metricsを出力します。

## Research Layout

学習・fine-tuning・pretrained model比較はアプリ本体や `scripts/` へ混在させず、`research/` に隔離します。

```text
research/rugby-event-detection/
├── README.md
├── pyproject.toml
├── run.py
├── config/
│   ├── dataset-spec.example.json
│   ├── event-aliases.json
│   └── model-benchmarks.json
├── src/sportaglytics_rugby_events/
│   ├── manifest.py
│   ├── dataset.py
│   ├── models.py
│   ├── training.py
│   ├── spotting.py
│   ├── metrics.py
│   └── benchmark.py
└── tests/
```

役割:

- SporTagLytics package/Timelineからmatch-level dataset manifestを作る
- pretrained backboneを同じsplitでfine-tuneする
- validationだけでconfidence thresholdを選ぶ
- unseen testへ固定thresholdを適用する
- 精度、時間誤差、local inference速度、license適格性を同じreportへ出す

`research/` はproduction dependencyではありません。Renderer/Electronからimportせず、生成checkpoint、映像、frame、`runs/` はgit管理しません。品質ゲートを通過した結果だけを、別工程でverified model packのrunner contractへ変換します。

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

長期判断を新規追加・変更する場合はADRへ記録します。自動イベント検出の実行境界・品質ゲートは [ADR 0022](adr/0022-verified-local-rugby-event-detection.md) を正とします。

## Placement Checklist

新規ファイル追加前に確認:

1. feature固有かsharedか、offline researchか。
2. UI描画と外部依存が分離されているか。
3. Viewから `window.electronAPI` を呼んでいないか。
4. feature外参照が `index.ts` 経由か。
5. Electron APIはmain/preload/gateway境界内か。
6. IPC contractは `src/types/ipc/` にあるか。
7. pure domain logicをHook/Viewへ埋め込んでいないか。
8. ML学習コードをproduction runtimeへ直接依存させていないか。
9. 新しい設計判断ならADR/docs indexを更新したか。
