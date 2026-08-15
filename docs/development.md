# 開発ガイド

実装規約の正本はリポジトリルートの `AGENTS.md` です。本書は開発環境、日常ワークフロー、品質ゲート、ローカルevent detection研究手順の実務ガイドです。

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [技術スタック](#技術スタック)
3. [ビルドと実行](#ビルドと実行)
4. [開発ワークフロー](#開発ワークフロー)
5. [品質ゲート](#品質ゲート)
6. [アーキテクチャ](#アーキテクチャ)
7. [自動イベント検出の開発](#自動イベント検出の開発)
8. [テストとデバッグ](#テストとデバッグ)
9. [リリースプロセス](#リリースプロセス)
10. [ドキュメント運用](#ドキュメント運用)

---

## 開発環境のセットアップ

### 必須要件

| ツール | バージョン |
| --- | --- |
| Node.js | 22.12以上 |
| pnpm | 9.1.0以上 |
| Git | 最新版 |

自動イベント検出のmodel研究を行う場合だけ、追加でPython 3.10〜3.12を使用します。通常のElectron開発・配布にPython runtimeは不要です。

### セットアップ

```bash
git clone <repository-url>
cd sportaglytics
pnpm install --frozen-lockfile
```

開発サーバー:

```bash
pnpm start
```

Electronを含む開発実行:

```bash
pnpm run electron:dev
```

---

## 技術スタック

- React 19
- TypeScript 5.4 (`strict: true`)
- Electron 43
- Material UI 7
- Video.js 8
- Vite 7
- Vitest 4
- pnpm 9

アプリはlocal-first desktop applicationです。RendererはNode/Electron APIを直接使用せず、typed preload APIを経由します。

自動イベント検出のoffline researchだけは `research/rugby-event-detection/` の独立Python環境でPyTorch / Transformers / PyTorchVideoを利用します。この依存はElectron packageへ含めません。

---

## ビルドと実行

Renderer build:

```bash
pnpm run build
```

Electron main TypeScript build:

```bash
pnpm run build:electron-main
```

Sandbox preload bundle:

```bash
pnpm run bundle:preload
pnpm run check:preload
```

Electron実行:

```bash
pnpm run electron:start
```

macOS package:

```bash
pnpm run electron:package:mac
```

配布版media toolchainは `scripts/build-media-tools.mjs` と ADR 0020 に従います。

---

## 開発ワークフロー

通常作業:

1. `develop` 最新からbranchを作る。
2. `<prefix>/<short-kebab-description>` を使う。
3. 実装と同じPRでtest/doc/ADRを更新する。
4. 全品質ゲートを実行する。
5. `develop` 宛てPRを作る。
6. CI結果を確認し、失敗を修正する。

通常prefix:

- `feature`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`
- `perf`

CommitはConventional Commitsを使います。

例:

```text
feat(coding): add button recording range settings
fix(event-detection): validate model operating threshold
docs(event-detection): document automatic coding workflow
```

---

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

このcheckはheavy model weightを取得せず、Python sourceのcompileとstdlibだけで動くthreshold/quality-gate unit testを実行します。

ADR変更時:

```bash
pnpm run check:adr
```

Preload / packaged Electron変更時は必要に応じて:

```bash
pnpm run build:electron-main
pnpm run bundle:preload
pnpm run check:preload
```

E2E:

```bash
pnpm run test:e2e
```

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestで以下を実行します。

- frozen-lockfile install
- lint
- renderer typecheck
- Electron typecheck
- architecture check
- ADR check
- Python research compile/unit test
- Vitest CI suite

CIをローカルテストの代わりにせず、可能な環境では同じコマンドを事前実行します。

---

## アーキテクチャ

詳細は [System Overview](system-overview.md) と [Project Structure](project-structure.md) を参照してください。

### Feature-First

依存方向:

```text
pages -> features -> shared
```

- `pages`: routing / feature composition
- `features`: Screen / Controller(or Hook) / View / Gateway / domain
- `shared`: cross-feature UI / types / pure services

### Renderer / Electron boundary

Renderer:

```text
View
  ↑ props/callback
Controller / Hook
  ↓
Gateway
  ↓
window.electronAPI
```

Electron:

```text
preload bridge
  ↓ typed IPC
main handler
  ↓
manager / domain / child process
```

`src` から `electron` / `ipcRenderer` を直接importしません。

### Viewの条件

Story対象Viewは:

- propsだけで描画可能
- `window.electronAPI` 非依存
- file dialog / URL/hash / persistence非依存
- app-wide state sourceを内包しない

---

## 自動イベント検出の開発

詳細仕様: [自動イベント検出](event-detection.md)

設計判断: [ADR 0022](adr/0022-verified-local-rugby-event-detection.md)

研究pipeline詳細: [`research/rugby-event-detection/README.md`](../research/rugby-event-detection/README.md)

### Product policy

自動イベント検出は通常Timelineを初期Codingする補助機能です。未検証modelをproduction UIへ露出させません。

初期研究対象:

1. Kickoff
2. Scrum
3. Lineout

`Maul` / `Goal Kick` もshared contractには存在しますが、class単位で品質ゲートを通過するまでUIには出ません。

Player tracking、ball tracking、player identity、高度なtackle判定は現在の実装対象外です。

### Model packとアプリ本体を分離する

アプリ本体には特定ML frameworkを直接組み込みません。

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

Runner内部はONNX Runtime等へ交換できますが、renderer contractは変えません。

### Model pack discovery

探索先:

```text
# development
resources/event-detection-models/<model>/

# packaged
<Resources>/event-detection-models/<model>/

# user local
<Electron userData>/event-detection-models/<model>/
```

最低構成:

```text
<model>/
├── manifest.json
├── bin/
│   └── runner
└── model files ...
```

`manifest.json` には:

- schemaVersion
- id/version/displayName
- status
- supported events
- event class別metrics
- evaluation時confidence threshold
- platform runner relative path
- runner SHA-256

を含めます。

`status: verified` だけでは有効になりません。アプリは品質指標とrunner hashを再検証します。

### 品質ゲート

Event class単位:

| Metric | Minimum |
| --- | ---: |
| Precision | 0.95 |
| Recall | 0.90 |
| unseen evaluation matches | 5 |
| TP timestamp within ±2 sec | 0.90 |

これらはSporTagLyticsのproduct promotion基準です。

### Match-level evaluation

同じ試合の隣接clip/frameをTrainとTestへ分割してはいけません。match IDで完全分離します。

Evaluation command:

```bash
pnpm run research:events:evaluate -- \
  research/rugby-event-detection/ground-truth.json \
  research/rugby-event-detection/predictions.json \
  research/rugby-event-detection/thresholds.json
```

Evaluator:

- `trainingMatchIds` とtest match IDの重複を拒否
- event type + matchごとに予測をmatching
- Precision / Recall
- ±2秒timestamp accuracy
- evaluated match count
- confidence threshold
- gate pass/fail

をJSONで出力します。

指定eventが1つでも基準未達ならexit code 1です。

### Pretrained model benchmark / fine-tuning

巨大なvideo backboneをゼロから学習しません。既存pretrained representationを共通datasetで比較し、ラグビーevent用classifierをfine-tuneします。

初期candidate:

| Model | Initial role | Production eligibility |
| --- | --- | --- |
| VideoMAE Base Kinetics | research baseline | 公開checkpointがCC BY-NC 4.0のため不可 |
| X3D-S Kinetics-400 | primary candidate | Apache-2.0、品質ゲート通過時のみ可 |
| SlowFast R50 Kinetics-400 | primary candidate | Apache-2.0、品質ゲート通過時のみ可 |

PyTorchVideo sourceはresearch `pyproject.toml` でcommit SHAを固定します。ライセンス適格性は `config/model-benchmarks.json` の `productionEligible` で評価結果と分離して管理します。精度が高くても非商用checkpointをproduction winnerへ選びません。

既存human Codingからdataset manifestを生成:

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output research/rugby-event-detection/runs/rugby-v1/manifest.json
```

最初はclassifier headだけを比較:

```bash
pnpm run research:events:benchmark -- \
  --manifest research/rugby-event-detection/runs/rugby-v1/manifest.json \
  --output-dir research/rugby-event-detection/runs/rugby-v1/head-screen \
  --strategy head
```

有望なproduction-eligible candidateだけfull fine-tuningを試します。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full
```

評価順序は固定します。

1. `train` matchでfine-tuning
2. `validation` match全体をsliding-window spotting
3. validationだけでevent別confidence thresholdを選択
4. thresholdをlock
5. 完全未見の`test` matchをscan
6. 既存product gateで判定
7. license適格性とlocal inference速度を合わせてproduction候補を選ぶ

Test結果を見てthresholdを再調整しません。Testを見てmodel設計を変更した場合、そのtest setは次のproduction claimに再利用せず、新しいheld-out setを用意します。

### Runner protocol

Electronから:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

Runner要件:

- network service不要のlocal execution
- requestに指定されたlocal video clipを読む
- package global timeline秒へ変換してcandidateを返す
- output JSON contractを守る
- main processのtimeout/cancelに応答できるprocessとして動く

Main process側は:

- `shell: false`
- finite timeout
- output/stderr size cap
- request/result cleanup
- path traversal check
- executable SHA-256 check
- result payload validation

を行います。

### Timeline integration

Model outputは直接persisted `timeline.json` を書き換えません。

Renderer domainで:

1. verified confidence thresholdを適用
2. disabled eventを除外
3. lead/lagを適用
4. existing Timelineとの重複を除外
5. `NewTimelineData[]` へ変換
6. `addTimelineDatas()` で1 state update

とします。

自動追加後は通常の `TimelineData` です。手動eventとの特別な分岐を作りません。

---

## テストとデバッグ

### Unit tests

```bash
pnpm run test:run
```

新しいpure domain logicにはunit testを追加します。

今回のevent detection関連例:

- recording lead/lag range
- confidence filter
- duplicate suppression
- model quality gate
- menu/window behavior
- settings migration
- validation threshold selection
- unseen match count gate

Research Python code:

```bash
pnpm run research:events:check
```

### E2E

```bash
pnpm run test:e2e
```

Electron UI/IPC/file association等、unit testだけでは保証できない経路を検証します。

### Debug

DevelopmentではHelp menuからDeveloper Toolsを利用できます。Main processのchild-process起動失敗はterminal logも確認してください。

Model packがUIへ出ない場合は、次を確認します。

1. manifest JSONがvalidか
2. `status: verified` か
3. event metricsがgateを満たすか
4. current platform/architecture runnerがあるか
5. SHA-256が一致するか
6. runner pathがmodel directory外を指していないか

Research benchmarkが失敗する場合は、dataset manifestのlocal path、各splitのイベント数、Python virtualenv、model checkpoint download可否、利用deviceのmemoryを確認してください。

---

## リリースプロセス

通常release:

1. release準備変更を `develop` へ統合
2. `develop -> main` PR
3. main PRの品質ゲート確認
4. merge後のmain commitへrelease tag
5. package/release assets作成

`main` への直接push/mergeは行いません。緊急hotfixのみ明示承認時の例外です。

Event detection model packの配布はアプリreleaseと独立できますが、verified statusを付ける前に評価artifactとrunner hashを固定してください。

---

## ドキュメント運用

変更時は [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix) に従います。

代表例:

- user behavior変更 → `user-guide.md`, `requirement.md`
- IPC/architecture変更 → `system-overview.md`
- directory配置変更 → `project-structure.md`
- build/script変更 → `development.md`, `testing.md`
- 長期判断 → `docs/adr/`
- 新規doc → `docs/README.md`
- user/contributor visible変更 → `CHANGELOG.md`

ADR追加・rename・status変更時:

```bash
pnpm run check:adr
```
