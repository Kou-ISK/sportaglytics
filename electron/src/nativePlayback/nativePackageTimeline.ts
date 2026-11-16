import {
  arrayValue,
  booleanValue,
  numberValue,
  objectValue,
  stringValue,
} from '../../../src/shared/validation/jsonValues';
import {
  deriveTimelineGaps,
  MAX_PACKAGE_TIMELINE_SECONDS as maximumTime,
} from '../../../src/types/package/clipTimeline';
import { getAngleOffset } from '../../../src/shared/media/mediaTimeline';
import type { VideoSyncData } from '../../../src/types/video/sync';

export interface NativeTimelineClip {
  readonly id: string;
  readonly reference: string;
  readonly timelineStartSeconds: number;
  readonly durationSeconds: number;
}
export interface NativeTimelineAngle {
  readonly id: string;
  readonly offsetSeconds: number;
  readonly clips: readonly NativeTimelineClip[];
}

const syncData = (raw: unknown, count: number): VideoSyncData | undefined => {
  if (raw === undefined) return undefined;
  const value = objectValue(raw);
  return {
    isAnalyzed: booleanValue(value.isAnalyzed),
    syncOffset: numberValue(value.syncOffset, -maximumTime, maximumTime),
    angleOffsets:
      value.angleOffsets === undefined
        ? undefined
        : arrayValue(value.angleOffsets, 0, count).map((offset) =>
            numberValue(offset, -maximumTime, maximumTime),
          ),
  };
};

/** Read current normalized placements only. Missing duration/placement is not
 * guessed from a neighbour or from an unverified decoder clock. */
export const parseNativePackageTimeline = (
  config: Record<string, unknown>,
  selected: readonly string[],
): readonly NativeTimelineAngle[] => {
  if (
    selected.length < 1 ||
    selected.length > 2 ||
    new Set(selected).size !== selected.length
  )
    throw Error('NATIVE_UNSUPPORTED_ANGLE_SELECTION');
  selected.forEach((id) => stringValue(id, 1, 128));
  const angles = arrayValue(config.angles, 1, 8).map(objectValue);
  const ids = angles.map((angle) => stringValue(angle.id, 1, 128));
  if (new Set(ids).size !== ids.length)
    throw Error('NATIVE_UNSUPPORTED_PACKAGE');
  const sync = syncData(config.syncData, angles.length);
  return selected.map((id) => {
    const index = ids.indexOf(id);
    if (index < 0) throw Error('NATIVE_UNSUPPORTED_ANGLE_SELECTION');
    const angle = angles[index];
    if (angle.sourceKind !== 'local' || angle.playbackFormat !== undefined)
      throw Error('NATIVE_UNSUPPORTED_PACKAGE');
    const clips = arrayValue(angle.clips, 1, 16).map(
      (raw): NativeTimelineClip => {
        const clip = objectValue(raw);
        if (clip.sourceKind !== 'local')
          throw Error('NATIVE_UNSUPPORTED_PACKAGE');
        const start = numberValue(clip.timelineStartSeconds, 0, maximumTime);
        const duration = numberValue(
          clip.durationSeconds,
          Number.MIN_VALUE,
          maximumTime,
        );
        if (start + duration > maximumTime)
          throw Error('NATIVE_UNSUPPORTED_PACKAGE');
        return Object.freeze({
          id: stringValue(clip.id, 1, 128),
          reference: stringValue(clip.relativePath, 1, 4096),
          timelineStartSeconds: start,
          durationSeconds: duration,
        });
      },
    );
    if (
      new Set(clips.map((clip) => clip.id)).size !== clips.length ||
      deriveTimelineGaps(clips).overlap
    )
      throw Error('NATIVE_UNSUPPORTED_PACKAGE');
    return Object.freeze({
      id,
      // Use the original package index, not the selected surface's position.
      offsetSeconds: getAngleOffset(sync, index),
      clips: Object.freeze(clips),
    });
  });
};
