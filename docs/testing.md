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
| `pnpm run test:run`                       | Vitest one-shot test run               |
| `pnpm run report:architecture-health`     | architecture compliance report         |
| `pnpm run report:large-files`             | large file soft-budget report          |
| `pnpm run check:preload`                  | preload bundle sanity check            |

`check:preload` は preload bridge、Electron API surface、release/package 周辺を触る場合に実行します。`report:*` は docs-only でも branch 状態を確認したい場合に実行します。

## Test Stack

- Test runner: Vitest
- React hooks / components: `@testing-library/react`
- DOM が必要な test: `/* @vitest-environment jsdom */`
- Electron main / preload: Electron API を mock し、実 BrowserWindow を起動しない unit test を優先
- Pure domain / converter / guard: colocated `*.test.ts`

Jest ではなく Vitest を使います。`@types/jest` は互換型として依存に残っている場合がありますが、新規 test は `vitest` から `describe`, `it`, `expect`, `vi` を import してください。

## When to Add Tests

| Change type                               | Expected tests                                           |
| ----------------------------------------- | -------------------------------------------------------- |
| Pure calculation / converter / normalizer | direct unit test in the same domain                      |
| IPC payload guard / shared type contract  | guard test under `src/types/ipc` or related domain       |
| Electron handler                          | mocked handler test under `electron/src/**`              |
| Preload bridge listener cleanup           | bridge or listener-store unit test                       |
| Feature hook with state orchestration     | `renderHook` test with mocked gateway                    |
| Import/export, migration, file format     | valid, legacy, invalid, and round-trip cases             |
| Clip export planning / validation         | source selection and mode matrix tests                   |
| Analysis report / dashboard output        | report data builder and pagination tests                 |
| Bug fix                                   | regression test that fails before the fix when practical |

UI snapshot tests are not the default. Prefer behavior, state, type guard, converter, and boundary tests that fail for real regressions.

## Test Placement

- Feature-specific tests stay near the feature file they cover.
- Shared domain tests stay under `src/shared/<domain>/` or `src/utils/`.
- Electron tests stay under `electron/src/`.
- Report generation tests stay under `src/report/`.
- Test fixtures that become large or reused should go under `testing/` or `fixtures/` in the owning feature.

Follow [project-structure.md](project-structure.md) when adding new test support files.

## Architecture Reports

Architecture checks intentionally separate hard violations from soft budget reporting.

- `pnpm run check:architecture`: CI fail condition.
- `pnpm run report:architecture-health`: compliance summary.
- `pnpm run report:large-files`: Warn Only; use the result to plan future refactors.

Current policy: file length budget is not a CI failure by itself. Responsibility mixing remains a MUST violation regardless of line count.

## Known Warnings

`pnpm run test:run` may emit Node `ExperimentalWarning` messages from toolchain dependencies that load ESM from CommonJS. Treat the command exit code and Vitest summary as authoritative unless the warning points to project code or a failing test.
