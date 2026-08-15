# Dataset source discovery

The research pipeline can build a dataset from one parent directory instead of requiring one path per match.

## Inspect without changing source data

```bash
pnpm run research:events:inspect -- \
  --root "/path/to/analysis-data" \
  --output /tmp/rugby-source-inspection.json
```

The command recursively finds every `timeline.json` below `--root` and reports:

- package root and timeline format (`legacy-array`, `timeline-v2`, or unknown)
- current `angles[]` config vs known legacy `tightViewPath` / `wideViewPath` config
- config keys without rewriting the package
- action-name counts, including team-prefixed names such as `帝京 スクラム`
- nearby files and video candidates
- whether the source can currently be prepared automatically
- a reason for every unresolved source

Unknown legacy layouts are reported instead of guessed. The command never modifies source packages.

## Prepare everything under one directory

```bash
pnpm run research:events:prepare -- \
  --root "/path/to/analysis-data" \
  --output research/rugby-event-detection/runs/rugby-events-v1/manifest.json
```

This mode:

1. recursively discovers all `timeline.json` files;
2. accepts current packages with `angles[]`;
3. accepts the known legacy `tightViewPath` / `wideViewPath` layout in either `.metadata/config.json` or root `config.json`;
4. recreates legacy angles in memory only and never rewrites source packages;
5. attempts to recover moved legacy videos by basename from the package `videos/` directory;
6. validates that the selected local video exists;
7. skips unresolved packages rather than requiring every match path to be entered manually;
8. creates deterministic match-level Train / Validation / Test splits using seed `42` by default.

When at least 12 usable matches exist, the automatic policy reserves five Test matches so the held-out product gate can satisfy its five-unseen-match requirement. Smaller datasets use an approximately 20% Test split for research iteration.

The output directory also receives:

- `manifest.auto-spec.json`: the exact package paths and frozen split assignment used for the run;
- `manifest.sources.json`: discovery details and skipped-source reasons.

The automatically generated split is reproducible. Change it only deliberately; do not move Test matches into Train after looking at Test qualification results.

For advanced datasets that need per-match angle selection or event-anchor offsets, the existing explicit `--spec` mode remains available.
