import type { TrackingRegion } from './trackingAnchor';
import { findTrackingAnchors } from './trackingAnchor';
import {
  annotationAtTime,
  annotationOffsetAt,
} from '../../../../shared/tactics/annotationMotion';
import { simplifyMotion } from '../../../../shared/tactics/simplifyMotion';
import type {
  DrawingKeyframe,
  DrawingObject,
} from '../../../../types/playlist/core';
import { getObjectBounds } from '../../components/annotationCanvasUtils';
import { createAnchoredFeatureTracker } from './anchoredFeatureTracker';
import { openVideoFrameReader } from './videoFrameReader';
export interface TrackingResult {
  object: DrawingObject;
  lost: boolean;
  confidence: number;
  trackedDuration: number;
}
export const trackAnnotation = async (
  source: string,
  object: DrawingObject,
  endTime: number,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
  fromTime = object.timestamp,
  targetRegion?: TrackingRegion,
): Promise<TrackingResult> => {
  const start = Math.max(object.timestamp, fromTime);
  const startingOffset = annotationOffsetAt(object, start);
  const localStart = start - object.timestamp;
  const bounds = getObjectBounds(annotationAtTime(object, start));
  if (!bounds) throw new Error('追跡する描画を選択してください。');
  const reader = await openVideoFrameReader(source, signal);
  try {
    const scaleX = reader.width / (object.baseWidth ?? reader.width);
    const scaleY = reader.height / (object.baseHeight ?? reader.height);
    const center = {
      x: Math.round(((bounds.minX + bounds.maxX) / 2) * scaleX),
      y: Math.round(
        (bounds.minY +
          (bounds.maxY - bounds.minY) *
            (bounds.maxY - bounds.minY > (bounds.maxX - bounds.minX) * 1.3
              ? 0.3
              : 0.5)) *
          scaleY,
      ),
    };
    // Attachment belongs to the drawing, not the selected upper-body search region.
    const attachment = {
      x: ((bounds.minX + bounds.maxX) / 2) * scaleX,
      y: ((bounds.minY + bounds.maxY) / 2) * scaleY,
    };
    const region = targetRegion
      ? {
          minX: targetRegion.minX * reader.width,
          maxX: targetRegion.maxX * reader.width,
          minY: targetRegion.minY * reader.height,
          maxY: targetRegion.maxY * reader.height,
        }
      : undefined;
    if (region) {
      center.x = (region.minX + region.maxX) / 2;
      center.y = (region.minY + region.maxY) / 2;
    }
    const movedRegion = (offset: {
      x: number;
      y: number;
    }): TrackingRegion | undefined =>
      region
        ? {
            minX: region.minX + offset.x,
            maxX: region.maxX + offset.x,
            minY: region.minY + offset.y,
            maxY: region.maxY + offset.y,
          }
        : undefined;
    let frame = await reader.read(start);
    const radius = Math.max(
      8,
      region
        ? (region.maxX - region.minX) / 2
        : ((bounds.maxX - bounds.minX) * scaleX) / 2,
    );
    const preferAbove = !region && ['disc', 'ring'].includes(object.type);
    let points = findTrackingAnchors(
      frame,
      center,
      radius,
      preferAbove,
      region,
    );
    const tracker = createAnchoredFeatureTracker(frame, points, attachment);
    let travel = { x: 0, y: 0 };
    let targetTravel = { x: 0, y: 0 };
    let prediction = { x: 0, y: 0 };
    const duration = Math.min(
      20,
      endTime - start,
      object.timestamp + 600 - start,
    );
    const keys: DrawingKeyframe[] = [{ time: localStart, ...startingOffset }];
    let lost = false;
    let confidence = 1;
    const steps = Math.ceil(duration * 30);
    for (let step = 1; step <= steps; step++) {
      const time = Math.min(duration, step / 30);
      const next = await reader.read(start + time);
      let match = tracker.advance(frame, next, points, prediction);
      if (!match.reliable) {
        points = findTrackingAnchors(
          frame,
          { x: center.x + targetTravel.x, y: center.y + targetTravel.y },
          radius,
          preferAbove,
          movedRegion(targetTravel),
        );
        match = tracker.advance(frame, next, points, prediction);
      }
      confidence = Math.min(confidence, match.confidence);
      if (!match.reliable) {
        lost = true;
        break;
      }
      travel = tracker.position();
      targetTravel = {
        x: targetTravel.x + match.dx,
        y: targetTravel.y + match.dy,
      };
      if (match.dx || match.dy) prediction = { x: match.dx, y: match.dy };
      keys.push({
        time: localStart + time,
        x: startingOffset.x + travel.x / scaleX,
        y: startingOffset.y + travel.y / scaleY,
      });
      points = match.points;
      if (points.length < 4)
        points = findTrackingAnchors(
          next,
          { x: center.x + targetTravel.x, y: center.y + targetTravel.y },
          radius,
          preferAbove,
          movedRegion(targetTravel),
        );
      frame = next;
      onProgress(step / steps);
      // キャンセルと描画のためイベントループへ制御を返す。
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (signal.aborted) throw new DOMException('中止しました', 'AbortError');
    }
    if (keys.length < 2)
      throw new Error(
        '追尾に必要な特徴が不足しています。選手の上半身を矩形で囲み、対象が隠れていない少し前の時刻から再試行してください。',
      );
    const prefix =
      object.motion?.keyframes.filter((key) => key.time < localStart) ?? [];
    const combined = [...prefix, ...simplifyMotion(keys)].slice(0, 256);
    if (combined[0]?.time !== 0) combined.unshift({ time: 0, x: 0, y: 0 });
    const finalKeys = combined.slice(0, 256);
    return {
      trackedDuration: Math.max(
        0,
        finalKeys[finalKeys.length - 1].time - localStart,
      ),
      object: {
        ...object,
        motion: {
          duration: finalKeys[finalKeys.length - 1].time,
          keyframes: finalKeys,
        },
      },
      lost:
        lost ||
        finalKeys[finalKeys.length - 1].time < keys[keys.length - 1].time,
      confidence,
    };
  } finally {
    reader.dispose();
  }
};
