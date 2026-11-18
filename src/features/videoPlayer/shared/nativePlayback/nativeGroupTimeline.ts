import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { NativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import { getAngleOffset } from '../../../../shared/media/mediaTimeline';
import { formatSource } from '../../../../shared/media/videoSource';

export interface NativeGroupTimelineSlot {
  angleId: string;
  clipId: string;
  playerId: string;
  sourceUrl: string;
  sourceTimeOffset: number;
  globalEnd: number;
}
export interface NativeGroupTimeline {
  key: string;
  slots: readonly [NativeGroupTimelineSlot, NativeGroupTimelineSlot];
}
/** Initial ordinary pair scope requires both static original ports to cover the
 * complete package. Clip/gap preparation is deliberately not inferred. */
export const resolveNativeGroupTimeline = (
  angles: readonly PackageMediaAngle[],
  sync: VideoSyncData | undefined,
): NativeGroupTimeline | null => {
  if (angles.length !== 2 || angles[0].id === angles[1].id) return null;
  const slots: NativeGroupTimelineSlot[] = [];
  for (const [index, angle] of angles.entries()) {
    const clip = angle.clips.length === 1 ? angle.clips[0] : null;
    const offset = getAngleOffset(sync, index);
    if (
      !clip ||
      clip.sourceKind !== 'local' ||
      angle.sourceKind !== 'local' ||
      !Number.isFinite(offset) ||
      !Number.isFinite(clip.timelineStartSeconds) ||
      !Number.isFinite(clip.durationSeconds) ||
      !clip.durationSeconds ||
      clip.gapBeforeSeconds !== 0
    )
      return null;
    const sourceTimeOffset =
      Math.round((offset - clip.timelineStartSeconds) * 120000) / 120000;
    const globalStart = Math.max(
      0,
      Math.round((clip.timelineStartSeconds - offset) * 120000) / 120000,
    );
    const globalEnd =
      Math.round(
        (clip.timelineStartSeconds + clip.durationSeconds - offset) * 120000,
      ) / 120000;
    const sourceUrl = formatSource(clip.source);
    if (
      globalStart !== 0 ||
      sourceTimeOffset < 0 ||
      globalEnd <= 0 ||
      globalEnd > 86400 ||
      !sourceUrl.startsWith('file:')
    )
      return null;
    slots.push({
      angleId: angle.id,
      clipId: clip.id,
      playerId: `video_${index}`,
      sourceUrl,
      sourceTimeOffset,
      globalEnd,
    });
  }
  if (slots[0].globalEnd !== slots[1].globalEnd) return null;
  return { key: JSON.stringify(slots), slots: [slots[0], slots[1]] };
};
export const nativeGroupTimelineMatches = (
  timeline: NativeGroupTimeline,
  binding: NativePlaybackGroupBinding,
): boolean =>
  binding.angles.every((angle, index) => {
    const slot = timeline.slots[index];
    return (
      angle.angleId === slot.angleId &&
      angle.clipId === slot.clipId &&
      angle.sourceUrl === slot.sourceUrl &&
      angle.globalStart === 0 &&
      angle.globalEnd === slot.globalEnd &&
      angle.sourceTimeOffset === slot.sourceTimeOffset
    );
  });
