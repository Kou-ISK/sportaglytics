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
| [0007](0007-audio-sync-offset-contract.md)                         | Audio sync offset contract                         | Accepted | 2026-05-06 |
| [0008](0008-dedicated-sub-window-runtime-and-synchronization.md)   | Dedicated sub-window runtime and synchronization   | Accepted | 2026-05-06 |
| [0009](0009-timeline-import-export-interoperability.md)            | Timeline import/export interoperability            | Accepted | 2026-05-06 |
| [0010](0010-ffmpeg-clip-export-execution-boundary.md)              | FFmpeg clip export execution boundary              | Accepted | 2026-05-06 |
| [0011](0011-dashboard-widget-system-and-analysis-consolidation.md) | Dashboard widget system and analysis consolidation | Accepted | 2026-05-06 |

## Status Values

- `Proposed`: 提案中。実装前または合意前。
- `Accepted`: 採用済み。実装と規約に反映済み。
- `Deprecated`: 今後使わないが、置き換え先がまだ完全ではない。
- `Superseded`: 別 ADR に置き換え済み。

## Operations

ADR の採番・命名・更新 lifecycle は [Documentation Guide の ADR Operations](../documentation-guide.md#adr-operations) に従います。

- ADR ID は永続識別子としてファイル名に必ず含めます。タイトルが一意でも ID は省略しません。
- ファイル名は `NNNN-short-title.md` とし、`NNNN` は 4 桁ゼロ埋めの既存最大 ID + 1 を使います。
- `short-title` は lowercase ASCII kebab-case にします。
- 先頭見出しは `# NNNN Title` とし、ファイル名の ADR ID と一致させます。
- merge 済み ADR はリネームまたはリナンバリングしません。
- ADR を追加・状態変更した場合は、この一覧を同じ PR で更新します。
- `Superseded` にする場合は、旧 ADR と新 ADR の両方に関係をリンクします。
- ADR を追加、リネーム、状態変更した場合は `pnpm run check:adr` を実行します。

## Template

```markdown
# NNNN Title

## Status

Accepted

## Date

YYYY-MM-DD

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A

## Context

## Decision

## Consequences
```
