# 開発ガイド

実装規約の正本はリポジトリルートの `AGENTS.md` です。本書は開発環境、日常ワークフロー、品質ゲート、ローカルevent detection研究手順の実務ガイドです。

## 開発環境

| ツール | バージョン |
| --- | --- |
| Node.js | 22.12以上 |
| pnpm | 9.1.0以上 |
| Git | 最新版 |

自動イベント検出のoffline model研究を行う場合だけPython 3.10〜3.12を追加で使用します。通常のElectron開発・配布にPython runtimeは不要です。

```bash
git clone <repository-url>
cd sportaglytics
pnpm install --frozen-lockfile
pnpm run electron:dev
```

## 技術スタック

- React 19 / TypeScript / Material UI 7
- Electron 43 / Video.js 8 / Vite 7 / Vitest 4
- local-first desktop application
- RendererはNode/Electron APIを直接使用せずtyped preload APIを経由
- event detection researchだけ `research/rugby-event-detection/` の独立Python環境でPyTorch / Transformers / PyTorchVideoを利用

Research dependencyはElectron packageへ含めません。

## ビルドと実行

```bash
pnpm run build
pnpm run build:electron-main
pnpm run bundle:preload
pnpm run check:preload
pnpm run electron:start
```

macOS package:

```bash
pnpm run electron:package:mac
```

配布版media toolchainは `scripts/build-media-tools.mjs` と ADR 0020 に従います。

## 開発ワークフロー

1. `develop` 最新からbranchを作る。
2. `<prefix>/<short-kebab-description>` を使う。
3. 実装と同じPRでtest/doc/ADRを更新する。
4. 全品質ゲートを実行する。
5. `develop` 宛てPRを作る。
6. CI結果を確認して失敗を修正する。

通常prefix: `feature`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`。
CommitはConventional Commitsを使います。

## 品質ゲート

PR merge前に必須:

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

Event detection research codeを変更した場合:

```bash
pnpm run research:events:check
```

このcheckはheavy model weightを取得せず、Python source compileとstdlibだけで動くthreshold / schema / quality-gate unit testを実行します。

ADR変更時:

```bash
pnpm run check:adr
```

Preload / packaged Electron変更時:

```bash
pnpm run build:electron-main
pnpm run bundle:preload
pnpm run check:preload
```

E2E:

```bash
pnpm run test:e2e
```

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestでfrozen install、lint、renderer/electron typecheck、architecture、ADR、Python research check、Vitestを実行します。

## アーキテクチャ

詳細は [System Overview](system-overview.md) と [Project Structure](project-structure.md) を参照してください。

依存方向:

```text
pages -> features -> shared
```

Renderer / Electron boundary:

```text
View
  ↑ props/callback
Controller / Hook
  ↓
Gateway
  ↓
window.electronAPI
  ↓
typed preload / IPC
  ↓
Electron main manager / child process
```

`src` から `electron` / `ipcRenderer` を直接importしません。

## 自動イベント検出の開発

- 詳細仕様: [自動イベント検出](event-detection.md)
- 設計判断: [ADR 0022](adr/0022-verified-local-rugby-event-detection.md)
- 研究pipeline: [`research/rugby-event-detection/README.md`](../research/rugby-event-detection/README.md)

### Product policy

自動イベント検出は通常Timelineを初期Codingする補助機能です。未検証modelをproduction UIへ露出させません。

初期対象はKickoff / Scrum / Lineoutです。Player tracking、ball tracking、player identity、高度なtackle判定は現在の対象外です。

### Model packとアプリ本体を分離する

```text
Renderer
  ↓ window.electronAPI.eventDetection
Preload
  ↓ typed IPC
Electron main
  ↓ verified child process
Model-pack runner
  ↓
ML runtime / model files
```

Runner内部はONNX Runtime等へ交換できますがrenderer contractは変えません。

探索先:

```text
resources/event-detection-models/<model>/
<Resources>/event-detection-models/<model>/
<Electron userData>/event-detection-models/<model>/
```

Model manifestにはschema/version/id、supported events、class別metrics、評価時confidence threshold、platform runner relative path、runner SHA-256を含めます。`status: verified` だけでは有効にならず、アプリが品質指標とrunner hashを再検証します。

### Product quality gate

Event class単位:

| Metric | Minimum |
| --- | ---: |
| Precision | 0.95 |
| Recall | 0.90 |
| unseen test matches | 5 |
| TP timestamp within ±2 sec | 0.90 |

通常event matching toleranceは±5秒です。

### Pretrained model research

巨大なvideo backboneをゼロから学習せず、既存pretrained representationへラグビーevent classifierをfine-tuneします。

初期candidate:

| Model | 役割 | Production eligibility |
| --- | --- | --- |
| VideoMAE Base Kinetics | research baseline | 公開checkpointがCC BY-NC 4.0のため不可 |
| X3D-S Kinetics-400 | primary candidate | Apache-2.0、品質ゲート通過時のみ |
| SlowFast R50 Kinetics-400 | primary candidate | Apache-2.0、品質ゲート通過時のみ |

PyTorchVideo sourceはresearch `pyproject.toml` でcommit SHAを固定します。License適格性は精度とは独立して管理し、非商用checkpointをproductionへ昇格させません。

### Dataset preparation

既存human Codingからmatch-level dataset manifestを生成します。

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output research/rugby-event-detection/runs/rugby-v1/manifest.json
```

同一試合の隣接clip/frameを別splitへ分けず、`train` / `validation` / `test` をmatch ID単位で完全分離します。

Code Window leadを含んだTimelineを教師データにする場合、dataset specの `eventAnchorOffsetsSeconds` に元lead秒数を指定し、`Timeline startTime + offset` で実際のevent anchorへ戻します。

### Validation-only screening

まずclassifier headだけを比較します。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/head-screen \
  --strategy head
```

`benchmark` が触るのは `train` と `validation` だけです。

1. Trainでfine-tuning
2. Validation全体をsliding-window spotting
3. Validationだけでclass別confidence thresholdを選択
4. Validation precision / recall / timestamp accuracy / runtimeでcandidateを比較
5. License適格modelだけのproduction rankingを別途作成

**Held-out Testはdecodeも評価もしません。**

有望なproduction-eligible candidateだけを必要に応じてfull fine-tuningします。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full
```

Head/fullの比較もValidationだけで完結させます。

### Held-out qualification

Model family、training strategy、stride/NMS、checkpoint、validation-selected thresholdsを凍結した後、1つのproduction-eligible modelだけをTestへ通します。

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/checkpoint.pt \
  --thresholds /path/to/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy full
```

Qualificationはcheckpoint model ID / strategy / labelsを検証し、research-only licenseのmodelを拒否します。出力にはcheckpoint/threshold SHA-256、locked thresholds、unseen-test metrics、`productGatePassed` を含めます。

Independent evaluator:

```bash
pnpm run research:events:evaluate -- \
  qualification/test-ground-truth.json \
  qualification/test-predictions.json \
  qualification/thresholds.json
```

Test結果を見てmodel、strategy、NMS、stride、thresholdを変更した場合、そのTest setは次のproduction claimへ再利用しません。

### Runner protocol

Electronから:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

Main process側は `shell: false`、finite timeout、output/stderr cap、cancel、request/result cleanup、path traversal、runner SHA-256、result payload validationを担当します。

### Timeline integration

Model outputは直接persisted `timeline.json` を書き換えません。Renderer domainでverified threshold、enabled event、lead/lag、duplicate suppressionを適用して `NewTimelineData[]` へ変換し、`addTimelineDatas()` で1 state updateとして追加します。

自動追加後は通常の `TimelineData` として扱います。

## テストとデバッグ

```bash
pnpm run test:run
pnpm run research:events:check
```

Event detection関連ではrecording range、confidence filter、duplicate suppression、model quality gate、settings migration、validation threshold selection、unseen match count、research schemaをtestします。

Model packがUIへ出ない場合:

1. manifest JSON
2. `status: verified`
3. class metrics
4. current platform/architecture runner
5. runner SHA-256
6. runner path traversal

を確認します。

Research実行失敗時はdataset manifestのlocal path、split別event数、Python virtualenv、checkpoint download、device memoryを確認します。

## リリースプロセス

1. release準備変更を `develop` へ統合
2. `develop -> main` PR
3. main PR品質ゲート
4. merge後のmain commitへrelease tag
5. package/release assets作成

`main` への直接push/mergeは行いません。Event detection model packはアプリreleaseと独立できますが、verified化前にqualification artifactsとrunner hashを固定します。

## ドキュメント運用

変更時は [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix) に従います。

- user behavior → `user-guide.md`, `requirement.md`
- IPC/architecture → `system-overview.md`
- directory配置 → `project-structure.md`
- build/script → `development.md`, `testing.md`
- 長期判断 → `docs/adr/`
- user/contributor visible → `CHANGELOG.md`
