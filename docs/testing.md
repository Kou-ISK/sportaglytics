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

| Command                                   | Purpose                                |
| ----------------------------------------- | -------------------------------------- |
| `pnpm exec tsc --noEmit`                  | renderer / shared TypeScript typecheck |
| `pnpm exec tsc -p electron/tsconfig.json` | Electron main / preload typecheck      |
| `pnpm run lint`                           | ESLint with zero warnings              |
| `pnpm run check:architecture`             | Feature-First / Electron boundary      |
| `pnpm run check:adr`                      | ADR filename / index consistency       |
| `pnpm run test:run`                       | Vitest one-shot test run               |
| `pnpm run report:architecture-health`     | architecture compliance report         |
| `pnpm run report:large-files`             | large file soft-budget report          |
| `pnpm run check:preload`                  | preload bundle sanity check            |

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

複数クリップの登録、絶対タイムライン配置、黒画面・無音の再合成、YouTubeクリップ切替、再起動後の復元は、実Electronと短いFFmpeg fixtureを使って検証します。先にRenderer、Electron main、preloadをbuildしてからE2Eを実行してください。

```bash
pnpm run build
pnpm exec tsc -p electron/tsconfig.json
pnpm run bundle:preload
pnpm run check:preload
pnpm run test:e2e:clip-sync
```

`test:e2e:clip-sync` は一時的な `.stpkg` と映像fixtureをOSのtemp directoryへ作成し、終了時に削除します。テストは次を確認します。

- 複数ローカル映像の登録、配置、空白区間、FFprobeでの最終duration
- 重複配置の拒否と、失敗時にconfig・従来再生映像が維持されること
- 同一アングルの複数YouTube URL、共通ホットキーによるクリップ切替
- アプリ再起動後の `timelineStartSeconds` とクリップ構成の復元
- loopback権限を取得できない場合に手動配置が維持されること

macOSのシステム音声取得許可ダイアログを伴う成功経路は、CIの権限拒否テストと分離します。署名・配布候補では、macOS 13以降の実機で許可済みプロファイルを使い、15秒取得、解析終了後のtrack停止、外部アプリ音声の混入警告を確認してください。

## Architecture Reports

Architecture checks intentionally separate hard violations from soft budget reporting.

- `pnpm run check:architecture`: CI fail condition.
- `pnpm run report:architecture-health`: compliance summary.
- `pnpm run report:large-files`: Warn Only; use the result to plan future refactors.

Current policy: file length budget is not a CI failure by itself. Responsibility mixing remains a MUST violation regardless of line count.

## Known Warnings

`pnpm run test:run` may emit Node `ExperimentalWarning` messages from toolchain dependencies that load ESM from CommonJS. Treat the command exit code and Vitest summary as authoritative unless the warning points to project code or a failing test.
