# Testing and Quality Gates

このドキュメントは SporTagLytics のテストと品質ゲート運用ガイドです。必須コマンドの正本は `AGENTS.md` です。

## Required Quality Gate

PR前に以下を通します。

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

Event detection research code変更時:

```bash
pnpm run research:events:check
```

ADR変更時:

```bash
pnpm run check:adr
```

| Command | Purpose |
| --- | --- |
| `pnpm exec tsc --noEmit` | renderer/shared TypeScript |
| `pnpm exec tsc -p electron/tsconfig.json` | Electron main/preload TypeScript |
| `pnpm run lint` | ESLint zero warnings |
| `pnpm run check:architecture` | Feature-First / Electron boundary |
| `pnpm run check:adr` | ADR filename/index consistency |
| `pnpm run test:run` | Vitest one-shot |
| `pnpm run test:ci` | serialized Vitest CI run |
| `pnpm run research:events:check` | Python research source compile + lightweight unit tests |
| `pnpm run check:preload` | preload bundle sanity |
| `pnpm run report:architecture-health` | architecture report |
| `pnpm run report:large-files` | soft file-size report |

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestでfrozen install、lint、renderer/electron typecheck、architecture、ADR、Python research check、Vitestを実行します。

## Test Placement

- pure domain logic → 同ディレクトリの `*.test.ts`
- React behavior → `*.test.tsx`
- shared contract / normalizer → contract近傍のtest
- Electron menu/manager pure behavior → `electron/src/**.test.ts`
- real BrowserWindow / file association / preload bundling → E2E
- offline model researchのpure metric/schema logic → `research/rugby-event-detection/tests/`

Heavy model weightをunit testで取得せず、process/model境界より内側のpure logicを分離してtestします。

## Settings / Timeline / IPC

Settingsやmigrationでは新fieldの保存読込、legacy default、invalid value正規化を検証します。Code Windowの `leadTimeSeconds` / `lagTimeSeconds` は未設定時0秒相当を維持します。

Timeline変更ではrange normalization、row ownership、history/Undo単位、duplicate/copy semanticsを検証します。自動Codingは `addTimelineDatas()` の1 state updateで追加するため、一括Undoを前提にします。

IPC / preload変更ではpayload guard、sender validation、explicit API、listener cleanup、invalid result rejectionを確認します。

```bash
pnpm run bundle:preload
pnpm run check:preload
```

## Automatic Event Detection Tests

自動イベント検出には3段階の品質確認があります。

### 1. Application code gate

Vitestで:

- recording lead/lag range
- confidence filter
- lead/lag Timeline変換
- existing/same-run duplicate suppression
- model quality gate
- settings migration
- Timeline reopen menu

を確認します。

### 2. Research code gate

```bash
pnpm run research:events:check
```

Heavy dependency/modelをCIへ毎回installせず、以下を確認します。

- Python source / entrypoint / testsのsyntax compile
- validation threshold selection
- Precision / Recall / timestamp gate
- unseen match count gate
- dataset/model metadata schema
- `productionEligible` の厳密なboolean validation

実modelのdownload/fine-tuningはローカルresearch環境で行います。

### 3. Model screening and promotion gate

#### Validation-only screening

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output /path/to/manifest.json

pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/benchmark \
  --strategy head
```

`benchmark` はTrainでfine-tuningし、Validationでmodel family / strategy / confidence thresholdを比較します。**Test splitをscanしてはいけません。**

Screeningで確認するもの:

- event class別Validation Precision / Recall
- timestamp accuracy
- local scan runtime
- checkpoint/threshold SHA-256
- licenseによるproduction eligibility

必要なら有望な1候補を `--strategy full` で再度Train/Validation比較します。

#### Held-out qualification

Model family、strategy、stride/NMS、checkpoint、Validation thresholdを凍結してから、1つのproduction-eligible modelだけをTestへ通します。

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/checkpoint.pt \
  --thresholds /path/to/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy full
```

独立evaluator:

```bash
pnpm run research:events:evaluate -- \
  qualification/test-ground-truth.json \
  qualification/test-predictions.json \
  qualification/thresholds.json
```

Product minimum per event class:

| Metric | Gate |
| --- | ---: |
| Precision | >= 0.95 |
| Recall | >= 0.90 |
| unseen matches | >= 5 |
| TP within ±2 sec | >= 0.90 |

通常matching toleranceは±5秒です。Evaluatorはdevelopment側match IDsとtest `matchId` の重複を拒否します。

Test結果を見た後でmodel family、training strategy、NMS、stride、confidence thresholdを変更した場合、そのTest setを次のproduction claimへ再利用してはいけません。新しいheld-out Test setを用意します。

Production候補はlicense条件も満たす必要があります。非商用checkpointは精度ゲートを通ってもverified production modelへ昇格させません。

Model packを `verified` にする前にqualificationの `productGatePassed`、independent evaluator、各class metrics、license、runner SHA-256を確認します。

## E2E

```bash
pnpm run test:e2e
```

個別:

```bash
pnpm run test:e2e:clip-sync
pnpm run test:e2e:code-window-menu
pnpm run test:e2e:export-progress
pnpm run test:e2e:timeline-rows
```

自動event detectionのreal model inference E2Eは、verified model packをCI artifactとして安全に供給できるまで通常CIへ含めません。Modelなし状態は正常系であり、UIは「検証済みモデルなし」を表示します。

## Debugging Failed CI

推奨順:

1. Install / lockfile
2. Lint
3. Renderer typecheck
4. Electron typecheck
5. Architecture
6. ADR check
7. Research Python check
8. Unit tests

最初の失敗stepを修正し、後続stepのskipを別の失敗と誤認しないようにします。

## Regression Policy

- 新機能のために既存testを無効化しない
- flaky testを単純skipしない
- legacy behaviorを変える場合はmigration testを追加
- security boundaryを緩めてtestを通さない
- event detection品質閾値を機能を見せるために下げない
- Test setをmodel/threshold選定へ利用しない
- license不適格modelを精度だけでproduction昇格させない
