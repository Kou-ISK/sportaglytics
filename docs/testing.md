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
| `pnpm run check:preload` | preload bundle sanity |
| `pnpm run report:architecture-health` | architecture report |
| `pnpm run report:large-files` | soft file-size report |

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestで frozen install、lint、renderer/electron typecheck、architecture、ADR、Vitestを実行します。

## Test Placement

原則:

- pure domain logic → 同ディレクトリの `*.test.ts`
- React behavior → `*.test.tsx`
- shared contract / normalizer → contract近傍のtest
- Electron menu/manager pure behavior → `electron/src/**.test.ts`
- real BrowserWindow / file association / preload bundling → E2E

外部processをunit testで実行する必要がない場合、process起動境界より内側のpure logicを先に分離してtestします。

## Changes That Require Tests

### Settings / migration

型・保存形式・normalizerを変える場合:

- 新fieldが保存/読込される
- invalid legacy valueが安全に落ちる
- field未存在時の旧挙動が維持される

Code Windowの `leadTimeSeconds` / `lagTimeSeconds` では、既存設定が0秒相当の挙動を維持し、negative valueが正規化で除外されることをtestします。

### Timeline

Timeline domain変更では:

- range normalization
- row color ownership
- migration
- history/Undo単位
- duplicate/copy semantics

を検証します。

複数eventの自動Codingは `addTimelineDatas()` の1 state updateで追加する設計なので、利用側は一括Undoを前提にします。

### IPC / Preload

新IPCでは最低限:

- payload guard
- sender validation
- explicit API surface
- listener cleanup
- invalid result rejection

を確認します。

Preload bridge変更時は:

```bash
pnpm run bundle:preload
pnpm run check:preload
```

も実行します。

## Automatic Event Detection Tests

自動イベント検出には2種類の品質ゲートがあります。

### 1. Application code gate

通常Vitestで以下を検証します。

- `recordingRange.test.ts`
  - lead/lag適用
  - legacy 0秒挙動
  - reverse start/end normalization
  - media duration clamp
- `candidatesToTimeline.test.ts`
  - confidence filter
  - lead/lag変換
  - existing Timelineとのduplicate suppression
  - same-run duplicate suppression
  - different event typeの共存
- `modelQualityGate.test.ts`
  - Precision / Recall / match count / temporal accuracy
  - class単位promotion
  - evaluated confidence threshold
- settings normalizer tests
  - lead/lag migration
- Electron menu tests
  - Timeline reopen action

### 2. Model promotion gate

ML modelの精度はVitestでは判定しません。match-level unseen datasetで別評価します。

```bash
pnpm run research:events:evaluate -- \
  research/rugby-event-detection/ground-truth.json \
  research/rugby-event-detection/predictions.json \
  research/rugby-event-detection/thresholds.json
```

Product minimum per event class:

| Metric | Gate |
| --- | ---: |
| Precision | >= 0.95 |
| Recall | >= 0.90 |
| unseen matches | >= 5 |
| TP within ±2 sec | >= 0.90 |

Evaluatorはground truth側の `trainingMatchIds` とtest `matchId` の重複を検出すると失敗します。同一試合の隣接frameをTrain/Testへrandom splitしてはいけません。

評価時confidence thresholdは出力metricsへ保存し、production manifestへ転記します。Runtime側ではこのthreshold未満へ下げられません。

Model packを `verified` にする前に evaluator exit code 0 と各class metricsを確認します。

## E2E

全E2E:

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

E2E対象例:

- package/video sync
- Code Window document/menu lifecycle
- export progress window
- detached Timeline rows/interaction
- preload bundle / BrowserWindow behavior

自動event detectionのreal model inference E2Eは、verified model packをCI artifactとして安全に供給できるようになるまで通常CIへ含めません。アプリ本体はmodelなし状態を正常系として扱い、UIは「検証済みモデルなし」を表示します。

## Debugging Failed CI

推奨順:

1. Install failure → `package.json` と `pnpm-lock.yaml` の整合性
2. Lint → warningを含め0件にする
3. Renderer typecheck
4. Electron typecheck
5. Architecture
6. ADR check
7. Unit tests

CI logの最初の失敗stepを修正し、後続stepの未実行を別の失敗と誤認しないようにします。

## Regression Policy

- 新機能のために既存testを無効化しない
- flaky testを単純skipしない
- legacy behaviorを変える場合はmigration testを追加
- security boundaryを緩めてtestを通さない
- 自動event detectionの品質閾値を機能を見せるために下げない
