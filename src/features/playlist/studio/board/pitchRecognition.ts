import type { PitchCalibration } from '../../../../types/playlist/core';
import type { TacticalMarker } from '../../../../types/playlist/tacticalBoard';
import { imageToPitch } from '../../../../shared/tactics/pitchProjection';

export interface PitchDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  kind: 'neutral' | 'ball';
}
const overlap = (a: PitchDetection, b: PitchDetection): number => {
  const intersection =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (
    intersection /
    Math.max(1e-9, a.width * a.height + b.width * b.height - intersection)
  );
};
export const suppressPitchDuplicates = (
  detections: PitchDetection[],
): PitchDetection[] => {
  const kept: PitchDetection[] = [];
  for (const detection of [...detections].sort((a, b) => b.score - a.score)) {
    if (
      ![
        detection.x,
        detection.y,
        detection.width,
        detection.height,
        detection.score,
      ].every(Number.isFinite) ||
      detection.width <= 0 ||
      detection.height <= 0
    )
      continue;
    if (
      !kept.some(
        (previous) =>
          previous.kind === detection.kind &&
          overlap(previous, detection) > 0.4,
      )
    )
      kept.push(detection);
  }
  return kept.slice(0, 64);
};
export const projectPitchDetections = (
  detections: PitchDetection[],
  calibration: PitchCalibration,
): TacticalMarker[] => {
  return suppressPitchDuplicates(detections).flatMap((detection, index) => {
    // Ground contact, not the centre of the player's body, belongs to the calibrated plane.
    const position = imageToPitch(calibration, {
      x: detection.x + detection.width / 2,
      y: detection.y + detection.height,
    });
    if (
      !position ||
      position.x < 0 ||
      position.y < 0 ||
      position.x > calibration.widthMeters ||
      position.y > calibration.lengthMeters
    )
      return [];
    return [
      {
        id: `candidate-${index}`,
        kind: detection.kind,
        label: detection.kind === 'ball' ? '' : String(index + 1),
        ...position,
      },
    ];
  });
};
