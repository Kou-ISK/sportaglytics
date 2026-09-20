import { useState } from 'react';
import type {
  PitchCalibration,
  DrawingObject,
} from '../../../types/playlist/core';
import {
  imageToPitch,
  calibrationRegion,
  isValidPitchCalibration,
  pitchToImage,
} from '../../../shared/tactics/pitchProjection';
import type { StudioContentRect } from './useStudioGesture';
export interface PitchCalibrationControls {
  editing: boolean;
  calibrated: boolean;
  valid: boolean;
  draft: PitchCalibration;
  distance: number | null;
  needsConfirmation?: boolean;
  onConfirmFrame?: () => void;
  onRegionChange?: (region: NonNullable<PitchCalibration['region']>) => void;
  onBegin: () => void;
  onCancel: () => void;
  onApply: () => void;
  onClear: () => void;
  onCornerChange: (index: number, x: number, y: number) => void;
  onSizeChange: (widthMeters: number, lengthMeters: number) => void;
  onAddZone: () => void;
}
const initial: PitchCalibration = {
  corners: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.9, y: 0.8 },
    { x: 0.1, y: 0.8 },
  ],
  widthMeters: 70,
  lengthMeters: 100,
};
export const usePitchCalibration = (params: {
  documentKey: string;
  enabled: boolean;
  calibration?: PitchCalibration;
  selected: DrawingObject | null;
  contentRect: StudioContentRect;
  onSave: (calibration: PitchCalibration | undefined) => void;
  onAdd: (object: DrawingObject) => void;
  time: number;
  clipStart?: number;
}): PitchCalibrationControls => {
  const [edit, setEdit] = useState<{
    key: string;
    draft: PitchCalibration;
  } | null>(null);
  const editing = edit?.key === params.documentKey;
  const draft = editing ? edit.draft : (params.calibration ?? initial);
  const selected = params.selected;
  const calibration = params.calibration;
  const relativeTime = Math.max(0, params.time - (params.clipStart ?? 0));
  const needsConfirmation =
    calibration?.referenceTime === undefined ||
    Math.abs(calibration.referenceTime - relativeTime) > 0.12;
  let distance: number | null = null;
  if (
    calibration &&
    !needsConfirmation &&
    selected &&
    !selected.motion &&
    ['line', 'arrow'].includes(selected.type) &&
    selected.endX !== undefined &&
    selected.endY !== undefined
  ) {
    const width = selected.baseWidth ?? params.contentRect.width;
    const height = selected.baseHeight ?? params.contentRect.height;
    const from = imageToPitch(calibration, {
      x: selected.startX / width,
      y: selected.startY / height,
    });
    const to = imageToPitch(calibration, {
      x: selected.endX / width,
      y: selected.endY / height,
    });
    if (from && to) distance = Math.hypot(to.x - from.x, to.y - from.y);
  }
  return {
    editing,
    calibrated: Boolean(calibration),
    valid: isValidPitchCalibration(draft),
    draft,
    distance,
    needsConfirmation,
    onConfirmFrame: () => {
      if (params.enabled && calibration)
        params.onSave({ ...calibration, referenceTime: relativeTime });
    },
    onRegionChange: (region) =>
      setEdit({ key: params.documentKey, draft: { ...draft, region } }),
    onBegin: () => {
      if (params.enabled)
        setEdit({ key: params.documentKey, draft: calibration ?? initial });
    },
    onCancel: () => setEdit(null),
    onApply: () => {
      if (params.enabled && isValidPitchCalibration(draft)) {
        params.onSave({ ...draft, referenceTime: relativeTime });
        setEdit(null);
      }
    },
    onClear: () => {
      if (params.enabled) params.onSave(undefined);
    },
    onCornerChange: (index, x, y) =>
      setEdit({
        key: params.documentKey,
        draft: {
          ...draft,
          corners: draft.corners.map((point, at) =>
            at === index
              ? {
                  x: Math.max(0, Math.min(1, x)),
                  y: Math.max(0, Math.min(1, y)),
                }
              : point,
          ),
        },
      }),
    onSizeChange: (widthMeters, lengthMeters) =>
      setEdit({
        key: params.documentKey,
        draft: { ...draft, widthMeters, lengthMeters, region: undefined },
      }),
    onAddZone: () => {
      if (!params.enabled || !calibration || needsConfirmation) return;
      const region = calibrationRegion(calibration);
      const points = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.75, 0.75],
        [0.25, 0.75],
      ].map(([x, y]) =>
        pitchToImage(calibration, {
          x: region.x + x * region.width,
          y: region.y + y * region.length,
        }),
      );
      if (points.some((point) => !point)) return;
      const path = points.flatMap((point) =>
        point
          ? [
              {
                x: point.x * params.contentRect.width,
                y: point.y * params.contentRect.height,
              },
            ]
          : [],
      );
      params.onAdd({
        id: crypto.randomUUID(),
        type: 'polygon',
        color: '#FFD60A',
        strokeWidth: 3,
        opacity: 0.8,
        path,
        startX: path[0].x,
        startY: path[0].y,
        timestamp: params.time,
        baseWidth: params.contentRect.width,
        baseHeight: params.contentRect.height,
      });
    },
  };
};
