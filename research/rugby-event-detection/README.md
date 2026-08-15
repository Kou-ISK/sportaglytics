# Rugby Event Detection Research

This directory contains the offline research pipeline used to decide whether a local rugby event detector is good enough to become a SporTagLytics model pack.

The pipeline does **not** make an experimental model user-facing. Production exposure remains controlled by the verified model-pack gate documented in [`docs/event-detection.md`](../../docs/event-detection.md).

## Scope

Initial event classes:

- `kickoff`
- `scrum`
- `lineout`
- `other` as the negative training class

The first comparison uses pretrained video backbones and the same match-level dataset split:

| Candidate | Pretraining | License policy | Product candidate |
| --- | --- | --- | --- |
| VideoMAE Base (`MCG-NJU/videomae-base-finetuned-kinetics`) | Kinetics-400 | CC BY-NC 4.0 checkpoint | No; research baseline only |
| X3D-S (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |
| SlowFast R50 (PyTorchVideo) | Kinetics-400 | Apache-2.0 repository/model distribution | Yes, subject to quality gate |

PyTorchVideo is pinned to commit `f3142bb05cdb56af0704ab6f0adfb0c7bbafe4a0` instead of the old PyPI release so the benchmark source is reproducible.

A model can rank highly in research while still being ineligible for production. `productionEligible` is part of `config/model-benchmarks.json`, and the benchmark will never select a non-commercial checkpoint as `productionWinner`.

## Data source

Use already human-coded SporTagLytics packages as supervision. The exporter reads:

- `.metadata/config.json`
- `timeline.json`
- local clips in the selected angle

Timeline actions are mapped through `config/event-aliases.json`. The event anchor is the existing Timeline instance `startTime`.

You should correct the human coding before exporting the dataset. Incorrect Timeline labels become incorrect training labels.

### Split policy

Split by **match**, never by frame or neighboring clip.

Recommended minimum before a production decision:

- enough training matches to cover teams, grounds, kit combinations, daylight/night, wide/close footage and camera heights
- separate validation matches for threshold selection
- at least **5 completely unseen test matches** because the product gate requires five

Do not move a match between splits after looking at test results. If the test set informs a design/model change, create a new held-out test set before making a production claim.

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

## 2. Screen all pretrained candidates

Start with classifier-head fine-tuning. It is substantially cheaper and prevents a large backbone from overfitting before we know whether its representation is useful for rugby.

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

`--device auto` uses CUDA, then Apple MPS, then CPU when available. Benchmark speed includes video decoding and preprocessing because those costs matter to the desktop product.

## 3. Full fine-tuning of the strongest eligible model

Only after head-only screening identifies a promising Apache-2.0 candidate:

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full \
  --epochs 10
```

The default learning rate is `1e-3` for head screening and `1e-5` for full fine-tuning. Both can be overridden explicitly.

## Event spotting evaluation

The benchmark is not evaluated as isolated clip classification alone.

1. Fine-tune on `train` matches.
2. Slide the model over whole `validation` matches.
3. Apply temporal non-maximum suppression per event class.
4. Select each event's confidence threshold using validation matches only.
5. Lock those thresholds.
6. Scan completely unseen `test` matches.
7. Evaluate the locked thresholds against the product gate.

The gate is intentionally identical to the application-side event-detector gate:

- Precision >= `0.95`
- Recall >= `0.90`
- at least `5` unseen test matches
- at least `0.90` of true positives within `±2s`
- normal event matching tolerance `±5s`

The default spotting stride is `0.5s`; default class-wise temporal suppression separation is `4s`. These are benchmark parameters and must be recorded when changed.

## Outputs

Each model directory contains:

```text
<model-id>/
├── checkpoint.pt
├── thresholds.json
├── validation-predictions.json
├── test-predictions.json
└── test-ground-truth.json
```

The run root contains `benchmark-report.json`, including:

- license and production eligibility
- training summary
- validation-selected thresholds
- unseen-test Precision / Recall / F1
- timestamp accuracy
- scan runtime per video minute
- per-event quality-gate result
- `productionWinner`, which remains `null` until an eligible model passes every event gate

`test-predictions.json`, `test-ground-truth.json` and `thresholds.json` are also compatible with the repository's independent Node evaluator:

```bash
pnpm run research:events:evaluate -- \
  <model>/test-ground-truth.json \
  <model>/test-predictions.json \
  <model>/thresholds.json
```

## Research integrity

- Do not benchmark on training matches and call the result accuracy.
- Do not select confidence thresholds on test matches.
- Do not mark a model `verified` based on clip-classification accuracy alone.
- Do not make a non-commercial checkpoint production eligible by editing the manifest.
- Do not commit match footage, extracted frames, checkpoints or downloaded pretrained weights.
- Keep human-coded ground truth immutable once a test set is used for a production decision.

A successful benchmark is evidence for the next step: export the eligible winner into the verified local model-pack/runner contract. It is not itself a production model pack.
