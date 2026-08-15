from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from torch import nn
from transformers import VideoMAEForVideoClassification, VideoMAEImageProcessor

from .schema import EVENT_TYPES, ModelCandidate
from .video import preprocess_kinetics_tensor

LABELS = (*EVENT_TYPES, "other")
LABEL_TO_ID = {label: index for index, label in enumerate(LABELS)}


def resolve_device(requested: str) -> torch.device:
    normalized = requested.strip().lower()
    if normalized != "auto":
        device = torch.device(normalized)
        if device.type == "cuda" and not torch.cuda.is_available():
            raise ValueError("CUDA was requested but is not available")
        if device.type == "mps" and not torch.backends.mps.is_available():
            raise ValueError("MPS was requested but is not available")
        return device
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


@dataclass
class ModelBundle:
    candidate: ModelCandidate
    model: nn.Module
    device: torch.device
    strategy: str
    processor: VideoMAEImageProcessor | None = None

    def prepare_batch(self, clips: list[np.ndarray]) -> torch.Tensor | list[torch.Tensor]:
        if not clips:
            raise ValueError("clips must not be empty")
        if self.candidate.family == "videomae":
            if self.processor is None:
                raise RuntimeError("VideoMAE processor is not initialized")
            processed = [
                self.processor(list(clip), return_tensors="pt")["pixel_values"][0]
                for clip in clips
            ]
            return torch.stack(processed, dim=0).to(self.device)

        side_size = self.candidate.side_size
        crop_size = self.candidate.crop_size
        if side_size is None or crop_size is None:
            raise ValueError(f"{self.candidate.model_id}: missing spatial preprocessing config")
        fast = torch.stack(
            [
                preprocess_kinetics_tensor(clip, side_size=side_size, crop_size=crop_size)
                for clip in clips
            ],
            dim=0,
        ).to(self.device)
        if self.candidate.checkpoint != "slowfast_r50":
            return fast

        alpha = self.candidate.slowfast_alpha or 4
        slow_length = max(1, fast.shape[2] // alpha)
        indices = torch.linspace(
            0,
            fast.shape[2] - 1,
            slow_length,
            device=fast.device,
        ).long()
        slow = torch.index_select(fast, 2, indices)
        return [slow, fast]

    def logits(self, inputs: torch.Tensor | list[torch.Tensor]) -> torch.Tensor:
        if self.candidate.family == "videomae":
            if not isinstance(inputs, torch.Tensor):
                raise TypeError("VideoMAE expects a tensor batch")
            outputs = self.model(pixel_values=inputs)
            logits = getattr(outputs, "logits", None)
            if not isinstance(logits, torch.Tensor):
                raise RuntimeError("VideoMAE did not return logits")
            return logits
        return self.model(inputs)

    def probabilities(self, clips: list[np.ndarray]) -> torch.Tensor:
        self.model.eval()
        with torch.no_grad():
            return torch.softmax(self.logits(self.prepare_batch(clips)), dim=1)

    def trainable_parameters(self) -> Iterable[nn.Parameter]:
        return (parameter for parameter in self.model.parameters() if parameter.requires_grad)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {
                "modelId": self.candidate.model_id,
                "labels": list(LABELS),
                "strategy": self.strategy,
                "stateDict": self.model.state_dict(),
            },
            path,
        )

    def load(self, path: Path) -> None:
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
        if not isinstance(checkpoint, dict):
            raise ValueError("checkpoint must contain an object")
        if checkpoint.get("modelId") != self.candidate.model_id:
            raise ValueError("checkpoint modelId does not match selected model")
        if checkpoint.get("strategy") != self.strategy:
            raise ValueError("checkpoint strategy does not match requested strategy")
        if checkpoint.get("labels") != list(LABELS):
            raise ValueError("checkpoint labels do not match the current event schema")
        state_dict = checkpoint.get("stateDict")
        if not isinstance(state_dict, dict):
            raise ValueError("checkpoint stateDict is missing")
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()


def _configure_trainable_parameters(
    model: nn.Module,
    classifier: nn.Module,
    strategy: str,
) -> None:
    if strategy not in ("head", "full"):
        raise ValueError("strategy must be 'head' or 'full'")
    if strategy == "full":
        for parameter in model.parameters():
            parameter.requires_grad = True
        return
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in classifier.parameters():
        parameter.requires_grad = True


def _build_videomae(
    candidate: ModelCandidate,
    strategy: str,
    device: torch.device,
) -> ModelBundle:
    label2id = dict(LABEL_TO_ID)
    id2label = {index: label for label, index in label2id.items()}
    processor = VideoMAEImageProcessor.from_pretrained(candidate.checkpoint)
    model = VideoMAEForVideoClassification.from_pretrained(
        candidate.checkpoint,
        num_labels=len(LABELS),
        label2id=label2id,
        id2label=id2label,
        ignore_mismatched_sizes=True,
    )
    classifier = getattr(model, "classifier", None)
    if not isinstance(classifier, nn.Module):
        raise RuntimeError("VideoMAE classifier head was not found")
    _configure_trainable_parameters(model, classifier, strategy)
    model.to(device)
    return ModelBundle(candidate, model, device, strategy, processor)


def _replace_pytorchvideo_classifier(model: nn.Module) -> nn.Module:
    blocks = getattr(model, "blocks", None)
    if blocks is None or len(blocks) == 0:
        raise RuntimeError("PyTorchVideo model has no blocks")
    head = blocks[-1]
    projection = getattr(head, "proj", None)
    if not isinstance(projection, nn.Linear):
        raise RuntimeError("PyTorchVideo classifier projection was not found")
    replacement = nn.Linear(projection.in_features, len(LABELS), bias=True)
    head.proj = replacement
    activation = getattr(head, "activation", None)
    if activation is not None:
        head.activation = None
    return replacement


def _build_pytorchvideo(
    candidate: ModelCandidate,
    strategy: str,
    device: torch.device,
) -> ModelBundle:
    if candidate.checkpoint == "x3d_s":
        from pytorchvideo.models.hub.x3d import x3d_s

        model = x3d_s(pretrained=True)
    elif candidate.checkpoint == "slowfast_r50":
        from pytorchvideo.models.hub.slowfast import slowfast_r50

        model = slowfast_r50(pretrained=True)
    else:
        raise ValueError(f"unsupported PyTorchVideo checkpoint: {candidate.checkpoint}")

    classifier = _replace_pytorchvideo_classifier(model)
    _configure_trainable_parameters(model, classifier, strategy)
    model.to(device)
    return ModelBundle(candidate, model, device, strategy)


def build_model(
    candidate: ModelCandidate,
    strategy: str,
    device_name: str,
) -> ModelBundle:
    device = resolve_device(device_name)
    if candidate.family == "videomae":
        return _build_videomae(candidate, strategy, device)
    if candidate.family == "pytorchvideo":
        return _build_pytorchvideo(candidate, strategy, device)
    raise ValueError(f"unsupported model family: {candidate.family}")
