# Architecture Decision Records

ADR は長期的な設計判断を残すための記録です。実装規約の正本は `AGENTS.md`、現行構造の要約は `docs/system-overview.md` です。ADR は「なぜその方針を選んだか」を補足します。

## Records

| ID                                                                 | Title                                              | Status   | Date       |
| ------------------------------------------------------------------ | -------------------------------------------------- | -------- | ---------- |
| [0001](0001-feature-first-boundaries.md)                           | Feature-First boundaries                           | Accepted | 2026-05-04 |
| [0002](0002-typed-electron-ipc-and-renderer-gateways.md)           | Typed Electron IPC and renderer gateways           | Accepted | 2026-05-04 |
| [0003](0003-shared-type-contracts-and-load-time-migration.md)      | Shared type contracts and load-time migration      | Accepted | 2026-05-04 |
| [0004](0004-doc-sync-and-documentation-source-of-truth.md)         | Doc sync and documentation source of truth         | Accepted | 2026-05-05 |
| [0005](0005-local-llm-analysis-boundary.md)                        | Local LLM analysis boundary                        | Accepted | 2026-05-05 |
| [0006](0006-application-document-formats-and-file-associations.md) | Application document formats and file associations | Accepted | 2026-05-05 |

## Status Values

- `Proposed`: 提案中。実装前または合意前。
- `Accepted`: 採用済み。実装と規約に反映済み。
- `Deprecated`: 今後使わないが、置き換え先がまだ完全ではない。
- `Superseded`: 別 ADR に置き換え済み。

## Template

```markdown
# NNNN Title

## Status

Accepted

## Date

YYYY-MM-DD

## Context

## Decision

## Consequences
```
