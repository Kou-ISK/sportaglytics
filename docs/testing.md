# Testing and Quality Gates

このドキュメントは SporTagLytics のテストと品質ゲートの運用ガイドです。必須コマンドの正本は `AGENTS.md` です。本書は、どの変更でどのテストを追加・実行するかの判断材料を提供します。

## Required Quality Gate

PR 前に以下を通します。

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

| Command                                   | Purpose                                      |
| ----------------------------------------- | -------------------------------------------- |
| `pnpm exec tsc --noEmit`                  | renderer / shared TypeScript typecheck       |
| `pnpm exec tsc -p electron/tsconfig.json` | Electron main / preload typecheck（no emit） |
| `pnpm run lint`                           | ESLint with zero warnings                    |
| `pnpm run check:architecture`             | Feature-First / Electron boundary            |
| `pnpm run check:adr`                      | ADR filename / index consistency             |
| `pnpm run test:run`                       | Vitest one-shot test run                     |
| `pnpm run report:architecture-health`     | architecture compliance report               |
| `pnpm run report:large-files`             | large file soft-budget report                |
| `pnpm run check:preload`                  | preload bundle sanity check                  |

`check:adr` は ADR を追加、リネーム、状態変更した場合に実行します。`check:preload` は preload bridge、Electron API surface、release/package 周辺を触る場合に実行します。`report:*` は docs-only でも branch 状態を確認したい場合に実行します。

## Test Stack

- Test runner: Vitest
- React hooks / components: `@testing-library/react`
- DOM が必要な test: `/* @vitest-environment jsdom */`
- Electron main / preload: Electron API を mock し、実 BrowserWindow を起動しない unit test を優先
- 実Electron E2E: PlaywrightのElectron driver
- Pure domain / converter / guard: colocated `*.test.ts`

Jest ではなく Vitest を使います。`@types/jest` は互換型として依存に残っている場合がありますが、新規 test は `vitest` から `describe`, `it`, `expect`, `vi` を import してください。

## When to Add Tests

| Change type                               | Expected tests                                            |
| ----------------------------------------- | --------------------------------------------------------- |
| Pure calculation / converter / normalizer | direct unit test in the same domain                       |
| IPC payload guard / shared type contract  | guard test under `src/types/ipc` or related domain        |
| Electron handler                          | mocked handler test under `electron/src/**`               |
| Preload bridge listener cleanup           | bridge or listener-store unit test                        |
| Feature hook with state orchestration     | `renderHook` test with mocked gateway                     |
| Import/export, migration, file format     | valid, legacy, invalid, and round-trip cases              |
| Package creation / clip synchronization   | unit tests plus real Electron E2E for package persistence |
| Clip export planning / validation         | source selection and mode matrix tests                    |
| Analysis report / dashboard output        | report data builder and pagination tests                  |
| Bug fix                                   | regression test that fails before the fix when practical  |

UI snapshot tests are not the default. Prefer behavior, state, type guard, converter, and boundary tests that fail for real regressions.

## Test Placement

- Feature-specific tests stay near the feature file they cover.
- Shared domain tests stay under `src/shared/<domain>/` or `src/utils/`.
- Electron tests stay under `electron/src/`.
- Report generation tests stay under `src/report/`.
- Test fixtures that become large or reused should go under `testing/` or `fixtures/` in the owning feature.

Follow [project-structure.md](project-structure.md) when adding new test support files.

## Clip Timeline Electron E2E

複数クリップの登録、絶対タイムライン配置、実行時の黒画面・無音、YouTubeクリップ切替、再起動後の復元は、実Electronと短いFFmpeg fixtureを使って検証します。各E2EコマンドはRenderer、Electron main、preloadのbuildとpreload検査を先に自動実行します。全Electron E2Eをまとめて実行する場合は `pnpm run test:e2e` を使います。

```bash
pnpm run test:e2e:clip-sync
```

`test:e2e:clip-sync` は一時的な `.stpkg` と映像fixtureをOSのtemp directoryへ作成し、終了時に削除します。テストは次を確認します。

- 複数ローカル映像の登録、配置、空白中の黒表示、パッケージ内に再生用複製が増えないこと
- 書き出し時だけ仮想タイムラインを一時合成し、FFprobeで最終durationとパッケージ不変性を確認
- 重複配置の拒否と、失敗時にconfig・従来再生映像が維持されること
- 同一アングルの複数YouTube URL、共通ホットキーによるクリップ切替
- アプリ再起動後の `timelineStartSeconds` とクリップ構成の復元
- 物理キー長押し時のrepeatイベントで再生/停止などのトグル操作が再実行されないこと
- コードウィンドウにフォーカスした状態の再生ホットキーが750ms以内にメイン映像へ反映されること
- 旧パッケージのアングル再生パスが元クリップ参照へ移行され、旧再生用ファイルを暗黙に削除しないこと
- loopback権限を取得できない場合に手動配置が維持されること

## Export Progress Electron E2E

書き出し中のウィンドウ操作と実進捗の連動は、30秒のFFmpeg fixtureを使う専用E2Eで検証します。

```bash
pnpm run test:e2e:export-progress
```

`test:e2e:export-progress` は、進捗ウィンドウがフォーカスを奪わないこと、書き出し中にメインウィンドウで新規パッケージ画面へ遷移できること、FFmpeg由来の0%と100%の間の進捗が単調増加すること、出力ファイルが生成されることを確認します。

release前は`pnpm audit`と`pnpm audit --prod`がともに既知脆弱性0件であることを確認します。`pnpm run media:build:all-mac`後に、`file`と`ffmpeg -version` / `ffprobe -version`で`x64` / `arm64`、FFmpeg 8.1.2の一致を確認します。probe processのtimeout・出力量上限は`mediaProcessRunner.test.ts`で検証します。

macOSのシステム音声取得許可ダイアログを伴う成功経路は、CIの権限拒否テストと分離します。署名・配布候補では、macOS 13以降の実機で許可済みプロファイルを使い、15秒取得、解析終了後のtrack停止、外部アプリ音声の混入警告を確認してください。

## Code Window Menu Electron E2E

メニューバーのドキュメント操作は、実Electronで「ファイル > 新規 / 開く」の構造、重複する「コードウィンドウを開く」とトップレベル「コーディング」が存在しないこと、`Command+N`相当のパッケージ作成ウィザード表示を検証します。コードウィンドウは空の `.stcw` 作成、選択した `.stcw` の表示、ウィンドウ内モード切替、実行・編集表示の一致、編集開始時にキャンバス寸法が変わらないことを確認します。設定画面を経由しないこと、「別名保存」1回につきnative save dialogが1回だけ開くこと、設定の検索・responsive layout、ヘルプの検索・responsive layoutも検証対象です。

```bash
pnpm run test:e2e:code-window-menu
```

## Timeline Rows and Resize Electron E2E

タイムライン行の追加・名称/色編集・行選択・ドラッグ並べ替え・削除、修飾キーなしのインスタンス行間移動、`Command+C/V`による選択行への貼り付け、`Option+Command`による長さ調整と手動インスタンス作成を検証します。加えて、ウィンドウを複数サイズへ変更した後も全映像とタイムラインが表示領域内に残ることを実Electronで確認します。

```bash
pnpm run test:e2e:timeline-rows
```

## Architecture Reports

Architecture checks intentionally separate hard violations from soft budget reporting.

- `pnpm run check:architecture`: CI fail condition.
- `pnpm run report:architecture-health`: compliance summary.
- `pnpm run report:large-files`: Warn Only; use the result to plan future refactors.

Current policy: file length budget is not a CI failure by itself. Responsibility mixing remains a MUST violation regardless of line count.

## Known Warnings

`pnpm run test:run` may emit Node `ExperimentalWarning` messages from toolchain dependencies that load ESM from CommonJS. Treat the command exit code and Vitest summary as authoritative unless the warning points to project code or a failing test.
