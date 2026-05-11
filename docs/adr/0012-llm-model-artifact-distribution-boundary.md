# 0012 LLM Model Artifact Distribution Boundary

## Status

Accepted

## Date

2026-05-10

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0005 Local LLM Analysis Boundary](0005-local-llm-analysis-boundary.md)

## Context

SporTagLytics uses local llama.cpp for AI analysis. GGUF model files can be several GB, may have independent licenses, and are user-selected runtime assets rather than application source code.

Development commonly places models under `public/llama/models/` so the app can discover them locally. However, Vite copies `public/` into `build/`, and Electron packaging includes `build/**/*` by default. Without an explicit boundary, local model files can be accidentally copied into ASAR or release artifacts, causing oversized packages, ASAR file-size failures, and unclear redistribution obligations.

## Decision

Official application packages exclude `*.gguf` model files by default.

- `public/llama/models/*.gguf` remains a local development/runtime convenience path and is ignored by git.
- Electron packages may bundle llama.cpp binaries and support files, but not local GGUF model weights.
- Packaging config must exclude `*.gguf` from app files and `extraResources` unless a future ADR explicitly approves model bundling.
- Packaged app users provide models through an absolute model path or a documented local resource placement outside the repository.

## Consequences

- Public release artifacts stay smaller and avoid accidental redistribution of model weights.
- Packaging works even when developers keep large local models under `public/llama/models/`.
- Users must obtain and configure compatible models separately.
- If the project later ships curated models, license review, storage/update strategy, privacy/user docs, and packaging changes require a new ADR.
