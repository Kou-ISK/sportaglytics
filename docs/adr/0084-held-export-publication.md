# 0084 Held-descriptor publication for native exports

## Status

Proposed

## Date

2026-11-14

## Context

Checking a candidate by pathname and later publishing that pathname can select a replacement file. Recursive temporary-directory cleanup can also remove an unexpected entry. A second pathname check alone does not make either operation atomic.

## Decision

The native v2 single-cut path transfers a Main-only publication lease into the enclosing output transaction. It retains the qualified file descriptor until publication and release finish. The lease is accepted only for the exact output transaction, once, while rendering remains active. The outer transaction does not reopen a rendered pathname or unlink a pathname it never created.

A signature/hash-verified host explicitly advertising `held-clone-v1` clones from inherited file and directory descriptors using an exclusive OS operation. Read-only APFS and volume clone-capability preflight occurs before generation. Legacy revision 8 keeps its existing v1 contract. Revision 9 without the publication capability and unsupported volumes return to the existing finite-budget encoder path before generating a large native candidate. Other platforms retain their existing publication implementation; this decision does not claim to fix their pathname races.

Once publication starts, a complete success receipt and actual child close are necessary, but post-publication descriptor and parent-identity checks must also succeed, including a concurrent cancellation. Missing receipts, timeouts, changed destination identity and uncertain outcomes are retained and never automatically retried or deleted. Probes and child output are bounded; a blocked OS filesystem operation cannot be promised to finish within a wall-clock deadline.

Temporary cleanup is nonrecursive and compares the job's recorded directory and entry identities. Unknown entries, replaced entries, unconfirmed partial outputs and failed close are retained and reported separately from committed outputs. Retained locations are information, not deletion authority. Subsequent jobs include retained disk usage through actual free-space checks and preserve the configured minimum free-space threshold; these checks are neither reservations nor hard quotas.

## Consequences

The descriptor lease removes the source-path handoff between qualification and final publication for this native path. Clone support is deliberately gated instead of making all Mac exports depend on it. In-place source changes detected around publication yield an uncertain result; metadata checks are not a security boundary against hostile concurrent same-UID writes. Likewise pathname cleanup checks cannot provide atomic identity-conditioned unlink. The supported trust boundary is cooperating application jobs in private staging directories, with observed external changes retained. Do not describe this as isolation from arbitrary processes running with the same user's authority.

No new dependency or third-party source is introduced. Native code remains covered by the existing source manifest, build-input hashes and signing verification. Local SDK-built helpers and mock IPC do not establish signed-distribution, GUI, Windows or external-filesystem acceptance. Those release gates remain separate.
