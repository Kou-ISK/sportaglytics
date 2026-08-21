# 0024 Experimental Event Detection Production Lane

## Status

Accepted

## Date

2026-08-19

## Related ADRs

- Extends and amends the product-availability portion of: [0023 External Rugby Event Model R&D Boundary](0023-external-rugby-event-model-rd-boundary.md)
- Extends: [0002 Typed Electron IPC and Renderer Gateways](0002-typed-electron-ipc-and-renderer-gateways.md)
- Extends: [0020 Verified Media Toolchain and Process Containment](0020-verified-media-toolchain-and-process-containment.md)

## Context

ADR 0023 separated private model R&D from the public SporTagLytics runtime and required production-qualified models to pass a Recall-first quality gate before being marked `verified`. That boundary remains correct, but it does not support an important product-validation step: evaluating whether a not-yet-qualified model actually reduces an analyst's manual Coding workload in the production application.

The current rugby event model has a high-Recall operating point for `restart`, `scrum`, and `lineout`, but has only been evaluated on a small validation set and produces many false positives. Treating it as `verified` would misrepresent its maturity. Blocking it entirely, however, prevents measuring the user workflow that determines whether further model development is worthwhile.

The security properties of a model runner are independent from its statistical quality. An experimental model must therefore never bypass executable integrity, path containment, IPC validation, timeout, cancellation, or result validation merely because its quality is not yet production-qualified.

## Decision

- The production application supports two explicit model statuses: `verified` and `experimental`.
- `verified` continues to use the existing runtime quality gate without relaxation: each exposed event must satisfy Recall >= 0.95 and unseen evaluated matches >= 5, with valid metrics and confidence threshold.
- `experimental` is a separate eligibility lane, not a quality-gate pass. It may be exposed when its manifest is structurally valid, every exposed event has valid measured metrics, and the current platform runner passes the same path containment, existence, SHA-256, request/result, timeout, cancellation, and process-containment checks as a verified runner.
- The renderer carries model status explicitly through the typed IPC contract. Unknown statuses and malformed model metadata are rejected at the renderer gateway boundary.
- When an experimental model is selected, the normal production UI must show a visible `試験` marker, an explanatory warning, and measured Recall, Precision, evaluated match count, and baseline confidence threshold. The UI must not imply that the model is verified or accurate enough for unattended use.
- Users may adjust each event's confidence threshold for the current detection workflow. Manifest metrics provide the initial threshold. Values are validated and clamped to 0.00-1.00. Lowering or raising the threshold does not change the model's recorded evaluation metrics or status.
- Accepted candidates continue to become ordinary `TimelineData`. No AI provenance field or parallel Timeline model is introduced. Experimental candidates are expected to be reviewed, deleted, or range-adjusted using the same editing workflow as manual Coding.
- Model execution remains local. Video paths, video content, inference inputs, and private training information are not uploaded by this feature.
- Deployable model packs are build artifacts, not source artifacts. The repository contains only an ignored staging directory and packaging contract. Raw videos, `.stpkg` data, frames, research runs, checkpoints, private source metadata, and deployable model binaries are not committed.
- On macOS, packaged model runners are finalized during `electron-builder`'s `afterPack` phase: each declared Darwin runner is Developer ID signed first, its post-sign SHA-256 is written into the packaged copy of `manifest.json`, and the runner path is excluded from electron-builder's later recursive re-sign pass. The surrounding `.app` is then signed and notarized normally. Runtime SHA verification therefore covers the exact executable bytes that ship to users rather than the pre-sign export artifact.
- A release may contain no event-detection model pack. In that case the application and all unrelated features continue to work; model discovery simply returns no runnable model for that platform.

## Consequences

- Product workflow validation can happen before a model qualifies as `verified` without weakening the verified quality bar.
- Users can see the statistical limitations of an experimental model instead of receiving a misleading quality signal.
- The same runner security boundary is maintained for both statuses, reducing the chance that an experimental path becomes a privileged bypass.
- Release automation gains an optional staging point for sanitized deployable model packs while preserving the R&D/privacy boundary defined by ADR 0023.
- macOS signing no longer invalidates the manifest integrity contract: the manifest records the signed runner bytes that are actually distributed, while the outer app signature/notarization still seals the final bundle.
- Experimental results require human review and may create substantially more Timeline instances than a verified model. This is intentional for Recall-first workflow validation and is communicated in the UI.
