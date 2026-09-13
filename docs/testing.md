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

| Command                                   | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `pnpm exec tsc --noEmit`                  | renderer/shared TypeScript        |
| `pnpm exec tsc -p electron/tsconfig.json` | Electron main/preload TypeScript  |
| `pnpm run lint`                           | ESLint zero warnings              |
| `pnpm run check:architecture`             | Feature-First / Electron boundary |
| `pnpm run check:adr`                      | ADR filename/index consistency    |
| `pnpm run test:run`                       | Vitest one-shot                   |
| `pnpm run test:ci`                        | serialized Vitest CI run          |
| `pnpm run check:preload`                  | preload bundle sanity             |
| `pnpm run report:architecture-health`     | architecture report               |
| `pnpm run report:large-files`             | soft file-size report             |

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestでfrozen install、lint、renderer/electron typecheck、architecture、ADR、Vitestを実行します。Model training/evaluationのCIは別private R&D repositoryの責務です。

## Test Placement

- pure domain logic → 同ディレクトリの `*.test.ts`
- React behavior → `*.test.tsx`
- shared contract / normalizer → contract近傍のtest
- Electron menu/manager pure behavior → `electron/src/**.test.ts`
- real BrowserWindow / file association / preload bundling → E2E

Heavy model weightやtraining frameworkをSporTagLytics unit testで取得しません。Public repositoryではmodel pack consumer boundaryだけをtestします。

## Settings / Timeline / IPC

Settingsやmigrationでは新fieldの保存読込、legacy default、invalid value正規化を検証します。Code Windowの `leadTimeSeconds` / `lagTimeSeconds` は未設定時0秒相当を維持します。

Timeline変更ではrange normalization、row ownership、history/Undo単位、duplicate/copy semanticsを検証します。自動Codingは `addTimelineDatas()` の1 state updateで追加するため、一括Undoを前提にします。

IPC / preload変更ではpayload guard、sender validation、explicit API、listener cleanup、invalid result rejectionを確認します。

```bash
pnpm run bundle:preload
pnpm run check:preload
```

## Automatic Event Detection Tests

SporTagLytics側では次を確認します。

- recording lead/lag range
- confidence filter
- lead/lag Timeline変換
- existing/same-run duplicate suppression
- model quality gate
- settings migration
- Timeline reopen menu
- verified manifest / runner SHA-256 / path traversal validation
- request/result IPC validation
- cancel / timeout / bounded child process behavior

Runtime quality gateはRecall優先です。最低条件はclassごとにRecall >= 0.95、match-level unseen evaluation >= 5で、Precisionは有限な0〜1の値として記録します。

高Recall operating pointでのfalse positives per match、処理時間、manual edit operations、実作業時間削減はprivate R&D qualificationで検証し、実用的でないmodelを`verified`へ昇格させない前提です。

## Model R&D Tests

Dataset preparation、training、hard-negative mining、threshold/NMS/stride探索、held-out qualification、model exportのtestは別private R&D repositoryで管理します。

Public repositoryのCIやtest fixtureへ、実チーム名、実試合名、ローカル絶対path、実動画file名、private diagnostic outputを持ち込みません。

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
7. Unit tests

最初の失敗stepを修正し、後続stepのskipを別の失敗と誤認しないようにします。

## Regression Policy

- 新機能のために既存testを無効化しない
- flaky testを単純skipしない
- legacy behaviorを変える場合はmigration testを追加
- security boundaryを緩めてtestを通さない
- Recall優先のruntime minimumを機能を見せるために下げない
- model training/evaluation codeをpublic app repositoryへ再混在させない
- private source-identifying fixtureをpublic CIへ入れない
- license不適格modelを精度だけでproduction昇格させない

## UI一括ゲート

`pnpm run verify` で型検査、lint、architecture/design-system/ADR、unit tests、アプリとStorybookのbuildを実行する。Storybook buildの成功は操作試験・a11y試験の成功を意味しない。`Workspace/*` storiesで表示と操作を別途確認し、Electronの実ファイル・映像操作はアプリで試験する。

## 起動画面と仕様の同期

`Workspace/Start` では初回・履歴あり・検索一致なし・読込中・エラー・dropをdark/lightと600/800/1280pxで確認する。fixtureは検索・履歴削除を実際に操作できる状態を持たせる。

- View: 名前・チーム・保存場所での検索、履歴削除と開く操作の分離、読込中の無効化、エラー詳細と再試行。
- Hook: 同時ロードの抑止、ダイアログ取消、失敗後の再試行、nativeイベントの購読解除。
- Drop: preloadで取得した単一 `.stpkg` だけを開き、複数・不正・読込中のdropを抑止。
- 実機: OSダイアログ、Finder/Explorerのdrop、外付けドライブ、旧形式移行、Session復元。fixtureやunit testでは実ファイル操作を確認したことにしない。

仕様を変えたときは[起動](start-workspace.md)・[Playlist](playlist-features.md)・[Paint](tactics.md)の該当正本とアプリ内Helpを更新する。CHANGELOGへの追記だけでは仕様同期を完了しない。コードの型・IPC定義を文書へ丸写しせず、実装参照が存在すること、旧UI名と廃止経路の説明が残っていないこともレビューする。

Timelineの伸縮は連続mousemove中に保存せず、mouseupで1回確定し、1回のUndo/Redoで範囲全体を復元することを確認します。Esc・modifier release・blurでは元の範囲へ戻し、再生ヘッドを移動させません。Paintでは位置数値の空欄、Enter、Esc、未変更blurと、◆ドラッグのEsc取消を確認します。

## Windowsの配布検証

[Windows CI](../.github/workflows/windows.yml)はWindows x64上でunitとElectron操作を検証する。`scripts/e2e-electron-launch.mjs` は `E2E_APP_PATH` を指定した場合にインストール済みアプリを起動する。NSISの導入・Explorer登録・アンインストール、同梱FFmpeg/llama.cppの依存DLL、予約文字と日本語を含む保存先を検査する。検証範囲とOS条件は[Windows版](windows.md)。
