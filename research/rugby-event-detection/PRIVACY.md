# Rugby Event Detection Research Privacy

The automatic `--root` research workflow is designed so source-team identity is not persisted in shareable training metadata.

## Public-safe automatic artifacts

Automatic `prepare` / `train` mode:

- assigns opaque `source-*` and `match-*` identifiers instead of directory or fixture names;
- uses an anonymous dataset fingerprint by default;
- removes `possessionLabel` and `sourceActionName` from persisted training events;
- creates local anonymous symlinks such as `segment-001.mp4` and stores those paths in the manifest instead of source video names;
- stores only anonymous source ids in the persistent split lock;
- migrates legacy v1 split locks containing source-relative names to anonymized v2 locks on the next automatic prepare/train run;
- omits raw source roots, package paths, video filenames and raw Coding action names from automatic source reports and generated dataset indexes;
- does not print source video filenames during whole-match scanning.

The symlink targets remain local filesystem implementation details and are under gitignored research output. Video files, frames, model checkpoints and research runs must not be committed.

## Private diagnostics

`research:events:inspect` intentionally remains a private troubleshooting command. It may show raw local paths, fixture names, Coding action names and nearby video filenames so malformed historical packages can be diagnosed. Its output must not be published or committed.

Explicit `prepare --spec` mode also preserves caller-provided identifiers and paths. Use only an already-anonymized spec if its generated manifest will be shared.

## What this does not anonymize

This policy removes source identity from filenames, paths, labels and persisted research metadata. It does **not** alter the pixels of the source match video. Team names, scoreboard graphics, shirt text, venue signage or other identifying visual content can still be present in decoded frames used for model training.

If visual-source anonymity is required as well, add a separate deterministic video redaction/cropping stage and validate that it does not materially degrade event detection before distributing trained weights.
