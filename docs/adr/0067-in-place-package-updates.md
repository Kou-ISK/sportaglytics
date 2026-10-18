# 0067 In-place package updates

## Status

Accepted

Supersedes the separate-destination migration decision in [0065](0065-unified-project-open.md). The single Open entry point and validation before saving remain.

## Date

2026-10-17

## Context

Users expect to keep the original file name and location after opening a project. Version 0.17.9 instead opened a migrated copy. Rebuilding from the old original would lose access to edits already made in that copy. Replacement also introduces a crash interval that a copy-only design did not have.

## Decision

- Open detects the structure internally. After preparation, the selected original path, including an extensionless name, is the active document and save destination. A current document is not converted again.
- Before conversion, inspect all revisions in the machine-local 0.17.9 index and all matching sibling markers. A single valid copy associated with an unchanged original supplies its **current complete contents**. Never choose a branch by modification time or lowest suffix. All existing copies remain intact.
- Multiple branches, changed originals, missing registered copies and invalid candidates require a content choice inside common Open. An untracked original also requires one content confirmation: 0.17.9 left no marker on the original, so lost index plus a moved edited copy cannot be distinguished from a first open. This question concerns which edits to use, not the storage format. A manually located copy must have a matching source path or matching original revision. Cancellation writes nothing.
- A receipt on the installed document records the adopted copy and revision. An unchanged previously adopted copy redirects to the original path. Later changes to that copy are never silently overwritten or automatically selected. The original's Open offers the content choice again; opening a diverged copy directly reports the conflict.
- A normally moved or duplicated current document keeps its history but does not compare that old location's branches as if they belonged to its new path. Opening it does not repeatedly prompt or convert it again.
- Check recording ownership, bound document windows, pending update leases, real write-open permission, free space, known structure and media references. Reject root symlinks/junctions. The app's single-instance policy and in-process leases exclude its concurrent writers. An unrelated application can still change files; source snapshots and publication checks reject detected changes.
- Create one deterministic transaction directory next to the original, on the same volume. Copy the selected contents into staging and stream SHA-256 over **all copied file bytes, including media**, before conversion. Convert config/timeline, validate references, and verify both source and adopted copy are unchanged. References from an adopted copy back into the original being replaced are rejected before moving the original.
- Persist an exclusive transaction journal before any destructive rename. The journal records the original, adopted contents, owner PID plus process start identity, full content digests, stage and backup identity. PID reuse does not establish ownership. Process-local leases also protect bind and recovery.
- Rename the original into the transaction's backup, then rename validated staging into the exact original location. Revalidate there, then move the transaction directory to a visible timestamp/UUID backup folder. The backup contains the untouched original, journal and restoration instructions. No existing backup is reused or deleted.
- This is a **recoverable two-step directory replacement**, not a single atomic exchange: there is a short interval with no original path. Each rename publishes one complete directory. Node's common filesystem API does not atomically exchange two nonempty directories on both Mac and Windows. Recovery runs before `realpath(original)` or historical `.stpkg` suffix fallback, so the missing-path interval is recoverable.
- On restart, inspect actual paths and digests rather than trusting journal phase alone. A missing original with a valid backup is restored and preparation can retry. A valid installed document with a backup is finalized. A same-name unrelated tree, invalid journal or changed content is preserved for recovery, and no save binding is granted. Only the recognizable pre-journal initialization footprint is quarantined automatically. Finder's `.DS_Store` and `.localized` do not invalidate post-publication content verification.
- Recognize a manually restored original by its full digest and a validated completed backup journal, even when the backup original has been moved out. Ask which contents to use and prioritize the restored contents; never silently re-adopt an older migration copy. A completed document retained elsewhere is excluded from automatic historical-copy candidates but remains explicitly selectable. Confirming the restored contents installs a new receipt, so later opens and saves preserve that choice. Journals record the prior receipt identity to cover later-generation restores without rehashing media on ordinary opens. Valid history from a relocated parent folder is not restoration evidence at the new path; malformed or symlinked history stops preparation without writing.
- On success show a nonmodal notice and keep restoration instructions and the reveal action available in File → Previous backup. Do not require a success alert to finish Open. Restore by closing the document, retaining the current version elsewhere, and moving the backed-up original to its old location. Directly opening the backup does not reconvert it. On a failed commit, show that retained work must not be deleted and allow revealing it.

## Consequences

The app keeps names and save targets stable, including historical copy edits, while retaining recovery evidence. Conversion temporarily needs space for one full staged copy; the retained original also continues using storage. Users choose which branch to keep when evidence cannot determine intent. Copy hashes prove byte preservation; they do not prove codec support or replace playback tests.

Process termination/restart is tested at nine commit boundaries, with same-path reopening, historical sibling copies, saved edits and backup digests. Permission/capacity failures, copy corruption, rollback failure, conflicting names and same-process retry are separate fault tests. These are not a guarantee against sudden power loss, filesystem hardware failure, arbitrary external writers, every network filesystem, or removal of an external drive during an OS rename.

Primary references: [Apple alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Apple rename](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/rename.2.html), [Windows MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw), [Node access limitations](https://nodejs.org/api/fs.html#fsaccesspath-mode-callback).
