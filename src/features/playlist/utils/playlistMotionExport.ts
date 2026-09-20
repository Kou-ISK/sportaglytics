import { annotationOffsetAt } from '../../../shared/tactics/annotationMotion';
import type {
  DrawingObject,
  AnnotationTarget,
} from '../../../types/playlist/core';
import type { ClipExportMotionOverlay } from '../../../shared/clipExport/clipExportTypes';

export const buildMotionOverlays = (
  objects: DrawingObject[],
  sourceStart: number,
  duration: number,
  render: (objects: DrawingObject[], target: AnnotationTarget) => string | null,
): ClipExportMotionOverlay[] => {
  if (
    objects.length > 64 ||
    objects.reduce(
      (total, object) => total + (object.motion?.keyframes.length ?? 1),
      0,
    ) > 4096
  )
    throw new Error(
      '動き・芝色処理を含む書き出しは、1クリップ64図形・合計4096位置までです。クリップを分けてください。',
    );
  const overlays = objects.flatMap((object) => {
    const target = object.target ?? 'primary';
    const png = render([object], target);
    if (!png)
      throw new Error(
        'Paintの描画を画像に変換できませんでした。書き出しを再試行してください。',
      );
    const start = object.timestamp - sourceStart;
    const visibleStart = Math.max(0, start);
    const visibleEnd = Math.min(
      duration,
      start + (object.motion?.duration ?? 0.12),
    );
    if (visibleEnd < visibleStart) return [];
    const from = visibleStart - start;
    const to = visibleEnd - start;
    // Keep source-coordinate offsets; rebasing time must not restart the motion.
    const keyframes = object.motion
      ? [
          { time: 0, ...annotationOffsetAt(object, object.timestamp + from) },
          ...object.motion.keyframes
            .filter((frame) => frame.time > from && frame.time < to)
            .map((frame) => ({ ...frame, time: frame.time - from })),
          ...(to > from && to <= (object.motion.keyframes.at(-1)?.time ?? 0)
            ? [
                {
                  time: to - from,
                  ...annotationOffsetAt(object, object.timestamp + to),
                },
              ]
            : []),
        ]
      : [{ time: 0, x: 0, y: 0 }];
    return [
      {
        start: object.motion ? visibleStart : Math.max(0, start - 0.12),
        end: visibleEnd,
        baseWidth: object.baseWidth ?? 1920,
        baseHeight: object.baseHeight ?? 1080,
        keyframes,
        target,
        png,
      },
    ];
  });
  if (
    overlays.some((entry) => entry.keyframes.length > 256) ||
    overlays.reduce((sum, entry) => sum + entry.keyframes.length, 0) > 4096
  )
    throw new Error(
      '書き出す位置情報が上限を超えています。クリップまたは追尾区間を分けてください。',
    );
  return overlays;
};
