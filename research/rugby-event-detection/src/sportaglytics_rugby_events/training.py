from __future__ import annotations

from dataclasses import dataclass
import random
from pathlib import Path

import torch
from torch import nn

from .dataset import ClipSample, decode_samples
from .models import LABELS, ModelBundle


@dataclass(frozen=True)
class TrainingSummary:
    epochs: int
    train_samples: int
    validation_samples: int
    best_validation_loss: float
    best_validation_accuracy: float


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
    with torch.no_grad():
        for batch in _batches(samples, batch_size):
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
    return loss_total / count, correct / count


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

    for epoch in range(epochs):
        random.Random(seed + epoch).shuffle(shuffled)
        if bundle.strategy == "full":
            bundle.model.train()
        else:
            # Keep frozen batch-normalization/statistical layers stable in head-only screening.
            bundle.model.eval()

        for batch in _batches(shuffled, batch_size):
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

        validation_loss, validation_accuracy = _evaluate_classification(
            bundle,
            validation_samples,
            batch_size,
            criterion,
        )
        if validation_loss < best_loss:
            best_loss = validation_loss
            best_accuracy = validation_accuracy
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in bundle.model.state_dict().items()
            }

    if best_state is None:
        raise RuntimeError("training did not produce a checkpoint")
    bundle.model.load_state_dict(best_state)
    bundle.model.to(bundle.device)
    bundle.save(output_path)
    return TrainingSummary(
        epochs=epochs,
        train_samples=len(train_samples),
        validation_samples=len(validation_samples),
        best_validation_loss=best_loss,
        best_validation_accuracy=best_accuracy,
    )
