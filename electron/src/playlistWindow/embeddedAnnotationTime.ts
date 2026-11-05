import type { ItemAnnotation } from '../../../src/types/playlist/core';

/** Source-time drawings move with the media origin. Motion keyframes, pitch
 * calibration, tactical board times and durations are already clip-relative. */
export const rebaseEmbeddedAnnotation = (
  annotation: ItemAnnotation | undefined,
  sourceStart: number,
): ItemAnnotation | undefined => {
  if (!annotation || sourceStart === 0) return annotation;
  return {
    ...annotation,
    objects: annotation.objects.map((object) => ({
      ...object,
      timestamp: object.timestamp - sourceStart,
    })),
  };
};
