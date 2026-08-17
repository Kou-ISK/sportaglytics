from __future__ import annotations

from dataclasses import dataclass
import random
from pathlib import Path

import torch
from torch import nn

from .dataset import ClipSample, LABEL_TO_ID, decode_samples
from .models import LABELS, ModelBundle
from .schema import EVENT_TYPES


@dataclass(frozen=True)
class TrainingSummary:
    epochs: int
    train_samples: int
    validation_samples: int
    best_validation_loss: float
    best_validation_accuracy: float


@dataclass(frozen=True)
class HardNegativeMiningSummary:
    candidate_pool: int
    scored_candidates: int
    selected_samples: int
    min_event_confidence: float
    minimum_selected_score: float | None
    mean_selected_score: float | None
    maximum_selected_score: float | None


def _progress(message: str) -> None:
    print(f"[rugby-events] {message}", flush=True)


def _batches(
    samples: list[ClipSample],
    batch_size: int,
) -> list[list[ClipSample]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    return [
        samples[index : index + batch_size]
        for index in range(0, len(samples), batch_size)
    ]


def _class_weights(samples: list[ClipSample], device: torch.device) -> torch.Tensor:
    counts = [0 for _ in LABELS]
    for sample in samples:
        counts[sample.label_id] += 1
    missing = [LABELS[index] for index, count in enumerate(counts) if count == 0]
    if missing:
        raise ValueError(
            "training split has no examples for required labels: " + ", ".join(missing)
        )
    total = sum(counts)
    weights = [total / (len(counts) * count) for count in counts]
    return torch.tensor(weights, dtype=torch.float32, device=device)


def _evaluate_classification(
    bundle: ModelBundle,
    samples: list[ClipSample],
    batch_size: int,
    criterion: nn.Module,
) -> tuple[float, float]:
    if not samples:
        raise ValueError("validation split has no clip samples")
    bundle.model.eval()
    loss_total = 0.0
    correct = 0
    count = 0
    batches = _batches(samples, batch_size)
    report_every = max(1, len(batches) // 5)
    with torch.no_grad():
        for batch_index, batch in enumerate(batches, start=1):
            clips = decode_samples(batch, bundle.candidate.num_frames)
            labels = torch.tensor(
                [sample.label_id for sample in batch],
                dtype=torch.long,
                device=bundle.device,
            )
            logits = bundle.logits(bundle.prepare_batch(clips))
            loss = criterion(logits, labels)
            loss_total += float(loss.detach().cpu()) * len(batch)
            correct += int((logits.argmax(dim=1) == labels).sum().detach().cpu())
            count += len(batch)
            if batch_index == 1 or batch_index == len(batches) or batch_index % report_every == 0:
                _progress(
                    f"validation clips {batch_index}/{len(batches)} batches "
                    f"({min(count, len(samples))}/{len(samples)} samples)"
                )
    return loss_total / count, correct / count


def mine_hard_negative_samples(
    bundle: ModelBundle,
    candidates: list[ClipSample],
    batch_size: int,
    max_samples: int,
    max_scored_candidates: int,
    min_event_confidence: float,
    seed: int,
) -> tuple[list[ClipSample], HardNegativeMiningSummary]:
    """Select background clips the current model most strongly mistakes for an event.

    Callers must provide candidates from the Train split only. This function never
    reads Validation/Test manifests and therefore keeps model selection leakage-safe.
    """

    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    if max_samples < 0 or max_scored_candidates < 0:
        raise ValueError("hard-negative sample limits must be >= 0")
    if not 0 <= min_event_confidence <= 1:
        raise ValueError("min_event_confidence must be between 0 and 1")
    if not candidates or max_samples == 0 or max_scored_candidates == 0:
        return [], HardNegativeMiningSummary(
            candidate_pool=len(candidates),
            scored_candidates=0,
            selected_samples=0,
            min_event_confidence=min_event_confidence,
            minimum_selected_score=None,
            mean_selected_score=None,
            maximum_selected_score=None,
        )

    rng = random.Random(seed)
    scoring_pool = list(candidates)
    if len(scoring_pool) > max_scored_candidates:
        scoring_pool = rng.sample(scoring_pool, max_scored_candidates)

    bundle.model.eval()
    scored: list[tuple[float, ClipSample]] = []
    batches = _batches(scoring_pool, batch_size)
    report_every = max(1, len(batches) // 5)
    processed = 0
    _progress(
        f"hard-negative mining start: backgroundPool={len(candidates)}, "
        f"scoring={len(scoring_pool)}, target={max_samples}, "
        f"minEventConfidence={min_event_confidence:.2f}"
    )
    with torch.no_grad():
        for batch_index, batch in enumerate(batches, start=1):
            clips = decode_samples(batch, bundle.candidate.num_frames)
            probabilities = bundle.probabilities(clips).detach().cpu()
            for row, sample in enumerate(batch):
                event_score = max(
                    float(probabilities[row, LABEL_TO_ID[event_type]].item())
                    for event_type in EVENT_TYPES
                )
                if event_score >= min_event_confidence:
                    scored.append((event_score, sample))
            processed += len(batch)
            if batch_index == 1 or batch_index == len(batches) or batch_index % report_every == 0:
                _progress(
                    f"hard-negative mining {processed}/{len(scoring_pool)} candidates "
                    f"({100.0 * processed / len(scoring_pool):.0f}%)"
                )

    scored.sort(key=lambda item: item[0], reverse=True)
    selected_pairs = scored[:max_samples]
    selected = [sample for _, sample in selected_pairs]
    selected_scores = [score for score, _ in selected_pairs]
    summary = HardNegativeMiningSummary(
        candidate_pool=len(candidates),
        scored_candidates=len(scoring_pool),
        selected_samples=len(selected),
        min_event_confidence=min_event_confidence,
        minimum_selected_score=min(selected_scores) if selected_scores else None,
        mean_selected_score=(
            sum(selected_scores) / len(selected_scores)
            if selected_scores
            else None
        ),
        maximum_selected_score=max(selected_scores) if selected_scores else None,
    )
    _progress(
        f"hard-negative mining complete: selected={summary.selected_samples}, "
        f"meanScore={summary.mean_selected_score if summary.mean_selected_score is not None else 0.0:.3f}"
    )
    return selected, summary


def train_model(
    bundle: ModelBundle,
    train_samples: list[ClipSample],
    validation_samples: list[ClipSample],
    output_path: Path,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    weight_decay: float,
    seed: int,
) -> TrainingSummary:
    if epochs <= 0:
        raise ValueError("epochs must be positive")
    if not train_samples:
        raise ValueError("training split has no clip samples")
    if learning_rate <= 0:
        raise ValueError("learning_rate must be positive")

    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    criterion = nn.CrossEntropyLoss(weight=_class_weights(train_samples, bundle.device))
    optimizer = torch.optim.AdamW(
        list(bundle.trainable_parameters()),
        lr=learning_rate,
        weight_decay=max(0.0, weight_decay),
    )

    best_loss = float("inf")
    best_accuracy = 0.0
    best_state: dict[str, torch.Tensor] | None = None
    shuffled = list(train_samples)

    _progress(
        f"training start: device={bundle.device}, strategy={bundle.strategy}, "
        f"train={len(train_samples)} clips, validation={len(validation_samples)} clips, "
        f"epochs={epochs}, batchSize={batch_size}"
    )

    for epoch in range(epochs):
        random.Random(seed + epoch).shuffle(shuffled)
        if bundle.strategy == "full":
            bundle.model.train()
        else:
            # Keep frozen batch-normalization/statistical layers stable in head-only screening.
            bundle.model.eval()

        batches = _batches(shuffled, batch_size)
        report_every = max(1, len(batches) // 10)
        running_loss = 0.0
        processed = 0
        _progress(f"epoch {epoch + 1}/{epochs} started ({len(batches)} batches)")
        for batch_index, batch in enumerate(batches, start=1):
            clips = decode_samples(batch, bundle.candidate.num_frames)
            labels = torch.tensor(
                [sample.label_id for sample in batch],
                dtype=torch.long,
                device=bundle.device,
            )
            optimizer.zero_grad(set_to_none=True)
            logits = bundle.logits(bundle.prepare_batch(clips))
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            batch_loss = float(loss.detach().cpu())
            running_loss += batch_loss * len(batch)
            processed += len(batch)
            if batch_index == 1 or batch_index == len(batches) or batch_index % report_every == 0:
                _progress(
                    f"epoch {epoch + 1}/{epochs}: {batch_index}/{len(batches)} batches "
                    f"({processed}/{len(shuffled)} samples), "
                    f"meanLoss={running_loss / processed:.4f}"
                )

        _progress(f"epoch {epoch + 1}/{epochs}: running validation classification")
        validation_loss, validation_accuracy = _evaluate_classification(
            bundle,
            validation_samples,
            batch_size,
            criterion,
        )
        _progress(
            f"epoch {epoch + 1}/{epochs} complete: "
            f"validationLoss={validation_loss:.4f}, "
            f"validationAccuracy={validation_accuracy:.3f}"
        )
        if validation_loss < best_loss:
            best_loss = validation_loss
            best_accuracy = validation_accuracy
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in bundle.model.state_dict().items()
            }
            _progress(f"epoch {epoch + 1}/{epochs}: new best checkpoint selected")

    if best_state is None:
        raise RuntimeError("training did not produce a checkpoint")
    bundle.model.load_state_dict(best_state)
    bundle.model.to(bundle.device)
    bundle.save(output_path)
    _progress(f"training checkpoint saved: {output_path}")
    return TrainingSummary(
        epochs=epochs,
        train_samples=len(train_samples),
        validation_samples=len(validation_samples),
        best_validation_loss=best_loss,
        best_validation_accuracy=best_accuracy,
    )
