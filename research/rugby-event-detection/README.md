# Rugby Event Detection Research

This directory contains the offline research pipeline used to decide whether a local rugby event detector is good enough to become a SporTagLytics model pack.

The pipeline does **not** make an experimental model user-facing. Production exposure remains controlled by the verified model-pack gate documented in [`docs/event-detection.md`](../../docs/event-detection.md).

## Scope

Initial event classes:

- `kickoff`
- `scrum`
- `lineout`
- `other` as the negative training class

The first comparison uses pretrained video backbones and one fixed match-level dataset split:

| Candidate | Pretraining | License policy | Product candidate |
| --- | --- | --- | --- |
| VideoMAE Base (`MCG-NJU/videomae-base-finetuned-kinetics`) | Kinetics-400 | CC BY-NC 4.0 checkpoint | No; research baseline only |
| X3D-S (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |
| SlowFast R50 (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |

PyTorchVideo is pinned to commit `f3142bb05cdb56af0704ab6f0adfb0c7bbafe4a0` instead of relying on an unpinned package release.

A model can rank highly in research while still being ineligible for production. `productionEligible` is part of `config/model-benchmarks.json`. Non-commercial checkpoints never enter the production ranking.

## Data source

Use already human-coded SporTagLytics packages as supervision. The exporter reads:

- `.metadata/config.json`
- `timeline.json`
- local clips in the selected angle

Timeline actions are mapped through `config/event-aliases.json`.

### Event anchor and Code Window lead

By default, the Timeline instance `startTime` is used as the event anchor. If the source Coding Window used a lead time, `startTime` is intentionally earlier than the analyst's button press/event onset. Do not silently train on that padded start.

The dataset spec supports an event-specific correction:

```json
{
  "eventAnchorOffsetsSeconds": {
    "kickoff": 5,
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

You should correct human coding before exporting the dataset. Incorrect labels or incorrect anchor offsets become incorrect training labels.

## Split policy

Split by **match**, never by frame or neighboring clip.

Required roles:

- `train`: gradient updates
- `validation`: model/strategy comparison and confidence-threshold selection
- `test`: final held-out qualification only

Recommended before a production decision:

- enough training matches to cover teams, grounds, kit combinations, daylight/night, wide/close footage and camera heights
- separate validation matches
- at least **5 completely unseen test matches**, because the product gate requires five

The `benchmark` command must never scan `test`. After a model, strategy and thresholds are frozen, `qualify` scans the held-out test split exactly for the production decision. If the test result causes any model/threshold design change, create a new held-out test set before making the next production claim.

## Environment

The research environment is intentionally separate from the Electron runtime.

```bash
cd research/rugby-event-detection
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

Model weights and benchmark outputs are local artifacts and must not be committed.

## 1. Prepare a dataset manifest

Copy `config/dataset-spec.example.json` and list each package with a stable `matchId` and explicit `train`, `validation` or `test` split.

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output research/rugby-event-detection/runs/rugby-events-v1/manifest.json
```

If `angleId` is omitted, preparation prefers `primaryAngleId`, then a local angle with role `primary`, then the first local angle. YouTube clips are excluded from this research pipeline.

The generated manifest stores absolute local video paths, clip-level `timelineStartSeconds`, durations and normalized event anchors. It does not copy video bytes.

## 2. Screen pretrained candidates on validation only

Start with classifier-head fine-tuning. This is cheaper and provides a representation screen before full backbone fine-tuning.

```bash
pnpm run research:events:benchmark -- \
  --manifest research/rugby-event-detection/runs/rugby-events-v1/manifest.json \
  --output-dir research/rugby-event-detection/runs/rugby-events-v1/head-screen \
  --strategy head \
  --device auto \
  --epochs 5
```

Select models explicitly when needed:

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/output \
  --models x3d-s-kinetics400,slowfast-r50-kinetics400
```

The screening command:

1. fine-tunes on `train` matches;
2. scans whole `validation` matches;
3. applies temporal non-maximum suppression per event class;
4. selects each event's confidence threshold on validation only;
5. ranks candidates using validation precision/recall/timestamp accuracy/runtime;
6. **does not decode or evaluate the test split**.

`--device auto` uses CUDA, then Apple MPS, then CPU when available. Scan speed includes video decoding and preprocessing because those costs matter to the desktop product.

The run root contains `benchmark-report.json` with separate `researchRanking` and production-license-filtered `productionRanking`. `screeningWinner` is only a development candidate, not a production-qualified model.

Each screened model contains:

```text
<model-id>/
├── checkpoint.pt
├── thresholds.json
└── validation-predictions.json
```

The checkpoint and threshold files include SHA-256 hashes in the report so the exact frozen artifacts can be identified before qualification.

## 3. Full fine-tune the strongest eligible candidate if needed

Only after head-only screening identifies a promising Apache-2.0 candidate:

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full \
  --epochs 10
```

This command still uses only `train` and `validation`. Comparing head/full strategy on the held-out test set is prohibited.

The default learning rate is `1e-3` for head screening and `1e-5` for full fine-tuning. Both can be overridden explicitly.

## 4. Freeze one candidate and run held-out qualification

Once model family, training strategy and validation-selected thresholds are fixed, run exactly one production-eligible checkpoint on the held-out test split:

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/frozen/checkpoint.pt \
  --thresholds /path/to/frozen/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy full
```

`qualify` rejects a `productionEligible: false` model. It verifies that the checkpoint model id, strategy and label schema match before scanning test data.

Qualification produces:

```text
qualification/
├── qualification-report.json
├── test-predictions.json
├── test-ground-truth.json
└── thresholds.json
```

`qualification-report.json` records the checkpoint SHA-256, source threshold SHA-256, locked thresholds, unseen-test metrics and `productGatePassed`.

The generated evaluation files are also compatible with the independent Node evaluator:

```bash
pnpm run research:events:evaluate -- \
  qualification/test-ground-truth.json \
  qualification/test-predictions.json \
  qualification/thresholds.json
```

## Product gate

The held-out qualification gate is intentionally identical to the application-side event-detector gate:

- Precision >= `0.95`
- Recall >= `0.90`
- at least `5` unseen test matches
- at least `0.90` of true positives within `±2s`
- normal event matching tolerance `±5s`

The default spotting stride is `0.5s`; default class-wise temporal suppression separation is `4s`. Freeze these settings along with the model before qualification.

## Research integrity

- Do not benchmark on training matches and call the result accuracy.
- Do not compare model families or fine-tuning strategies on the held-out test set.
- Do not select confidence thresholds on test matches.
- Do not mark a model `verified` based on isolated clip-classification accuracy.
- Do not make a non-commercial checkpoint production eligible by editing metadata.
- Do not commit match footage, extracted frames, checkpoints or downloaded pretrained weights.
- Keep human-coded ground truth immutable once a test set is used for a production decision.
- If a test result changes the model, strategy, NMS, stride or thresholds, retire that test set from future production claims and create a new held-out set.

A successful qualification is evidence for the next step: export the frozen eligible model into the verified local model-pack/runner contract. It is not itself a production model pack.
