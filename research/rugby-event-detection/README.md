# Rugby Event Detection Research

This directory contains the offline research pipeline used to decide whether a local rugby event detector is good enough to become a SporTagLytics model pack.

The pipeline does **not** make an experimental model user-facing. Production exposure remains controlled by the verified model-pack gate documented in [`docs/event-detection.md`](../../docs/event-detection.md).

## Scope

Initial event classes:

- `restart`: 50m kickoff, 22m dropout, try-line / goal-line dropout and equivalent kick restarts
- `scrum`
- `lineout`
- `other` as the negative training class

`restart` is the canonical class. Historical Coding names such as `Kickoff` / `キックオフ` are accepted as aliases and normalized to `restart`; the model does not learn a separate `kickoff` class.

The first comparison uses pretrained video backbones and one fixed match-level dataset split:

| Candidate | Pretraining | License policy | Product candidate |
| --- | --- | --- | --- |
| VideoMAE Base (`MCG-NJU/videomae-base-finetuned-kinetics`) | Kinetics-400 | CC BY-NC 4.0 checkpoint | No; research baseline only |
| X3D-S (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |
| SlowFast R50 (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |

PyTorchVideo is pinned to commit `f3142bb05cdb56af0704ab6f0adfb0c7bbafe4a0` instead of relying on an unpinned package release.

## Fast path: prepare and train with one command

Once the Python research environment is installed, the normal first run only needs the parent directory containing already-coded matches:

```bash
pnpm run research:events:train -- \
  --root "/absolute/path/to/coded-matches"
```

This command:

1. recursively finds supported current and legacy SporTagLytics packages;
2. accepts only matches that contain complete supervision for `restart`, `scrum` and `lineout`;
3. normalizes Coding aliases such as `リスタート`, `Kickoff`, `キックオフ`, `スクラム` and `ラインアウト`;
4. creates deterministic match-level Train / Validation / Test splits;
5. trains the production-eligible X3D-S Kinetics-400 candidate with classifier-head fine-tuning for 5 epochs by default;
6. scans Validation and selects confidence thresholds there;
7. never decodes or evaluates the held-out Test split.

The default output is under:

```text
research/rugby-event-detection/runs/<source-root-name>-x3d-head/
```

Use `--output-dir`, `--epochs`, `--strategy`, `--model` or the scan parameters only when intentionally running a controlled experiment. Do not use Test to choose those values.

## Environment

The research environment is intentionally separate from the Electron runtime. Python 3.10–3.12 is required; Python 3.11 is the recommended development version.

```bash
cd research/rugby-event-detection
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
cd ../..
```

Model weights and benchmark outputs are local artifacts and must not be committed.

## Data source

Use already human-coded SporTagLytics packages as supervision. Automatic discovery supports the current package layout and the known legacy `tightViewPath` / `wideViewPath` layout without modifying source data. Timeline arrays from the legacy format are also accepted.

The exporter uses:

- package `config.json` / `.metadata/config.json`
- `timeline.json`
- local clips in the selected angle

Timeline actions are mapped through `config/event-aliases.json`.

A match discovered automatically is treated as safe complete supervision only when it contains at least one coded `restart`, `scrum` and `lineout`. This prevents a real but uncoded event from being silently treated as negative supervision. Skipped matches and reasons are written to the source report.

### Restart semantics

The Coding action `リスタート` intentionally pools several rugby restart types:

- 50m kickoff / halfway restart
- 22m dropout
- try-line / goal-line dropout
- equivalent actions explicitly coded as Restart

These are one `restart` detection class for the initial model. Subtype classification can be investigated later with a separate dataset once enough examples exist.

### Event anchor and Code Window lead

By default, the Timeline instance `startTime` is used as the event anchor. If the source Coding Window used a lead time, `startTime` is intentionally earlier than the analyst's button press/event onset. Do not silently train on that padded start.

The explicit dataset spec supports event-specific correction:

```json
{
  "eventAnchorOffsetsSeconds": {
    "restart": 5,
    "scrum": 8,
    "lineout": 5
  }
}
```

The exporter computes:

```text
training anchor = Timeline startTime + eventAnchorOffsetsSeconds[eventType]
```

Set the offset to the source Code Window lead when the Timeline event was created with lead padding. Leave it at `0` for manually trimmed/onset-aligned events. A package may override the top-level offsets with its own `eventAnchorOffsetsSeconds` object.

## Dataset split policy

Split by **match**, never by frame or neighboring clip.

Required roles:

- `train`: gradient updates
- `validation`: model/strategy comparison and confidence-threshold selection
- `test`: final held-out qualification only

Before a production decision, reserve at least **5 completely unseen test matches**, because the product gate requires five. Automatic preparation reserves five Test matches when at least 12 safely coded matches are available.

The `benchmark` and one-command `train` workflows must never scan `test`. After a model, strategy and thresholds are frozen, `qualify` scans the held-out Test split exactly for the production decision. If the Test result causes any model/threshold/strategy/stride/NMS change, retire that Test set and create a new held-out set before the next production claim.

## Manual research workflow

### Inspect sources

```bash
pnpm run research:events:inspect -- \
  --root "/absolute/path/to/coded-matches" \
  --output /tmp/rugby-source-inspection.json
```

### Prepare only

```bash
pnpm run research:events:prepare -- \
  --root "/absolute/path/to/coded-matches" \
  --output research/rugby-event-detection/runs/rugby-events-v1/manifest.json
```

The explicit `--spec` workflow remains available for manual angle selection or package-specific anchor corrections.

### Screen pretrained candidates on Validation only

```bash
pnpm run research:events:benchmark -- \
  --manifest research/rugby-event-detection/runs/rugby-events-v1/manifest.json \
  --output-dir research/rugby-event-detection/runs/rugby-events-v1/head-screen \
  --models x3d-s-kinetics400 \
  --strategy head \
  --device auto \
  --epochs 5
```

The screening command fine-tunes on Train, scans whole Validation matches, applies class-wise temporal NMS, selects confidence thresholds on Validation, and ranks candidates without touching Test.

### Full fine-tune only after screening

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full \
  --epochs 10
```

The default learning rate is `1e-3` for head screening and `1e-5` for full fine-tuning.

### Frozen held-out qualification

Once model family, strategy, stride/NMS, checkpoint and Validation thresholds are frozen:

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/checkpoint.pt \
  --thresholds /path/to/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy head
```

Qualification produces `qualification-report.json`, `test-predictions.json`, `test-ground-truth.json` and `thresholds.json`.

## Product gate

Each event class must independently satisfy:

- Precision >= `0.95`
- Recall >= `0.90`
- at least `5` unseen Test matches
- at least `0.90` of true positives within `±2s`
- normal event matching tolerance `±5s`

The default spotting stride is `0.5s`; default class-wise temporal suppression separation is `4s`. Freeze these settings with the model before qualification.

## Research integrity

- Do not benchmark on training matches and call the result accuracy.
- Do not compare model families or fine-tuning strategies on held-out Test.
- Do not select confidence thresholds on Test.
- Do not mark a model `verified` based on isolated clip-classification accuracy.
- Do not make a non-commercial checkpoint production eligible by editing metadata.
- Do not commit match footage, extracted frames, checkpoints or downloaded pretrained weights.
- Keep human-coded ground truth immutable once a Test set is used for a production decision.
- If a Test result changes the model, strategy, NMS, stride or thresholds, retire that Test set from future production claims.

A successful qualification is evidence for the next step: export the frozen eligible model into the verified local model-pack/runner contract. It is not itself a production model pack.
