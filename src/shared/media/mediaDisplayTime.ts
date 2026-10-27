import { resolveMediaTime } from './mediaTimeline';
import type { MediaTimeline, MediaTimelineClip } from './mediaTimeline';

/** Keep the last source mounted at its exact terminal endpoint. Timeline
 * membership/export remain end-exclusive; internal gaps still show no source. */
export const resolveMediaDisplayTime = (
  timeline: MediaTimeline,
  globalTime: number,
): ReturnType<typeof resolveMediaTime> => {
  const active = resolveMediaTime(timeline, globalTime);
  if (active) return active;
  let last: MediaTimelineClip | undefined;
  for (const clip of timeline.clips)
    if (!last || clip.timelineStartSeconds > last.timelineStartSeconds)
      last = clip;
  if (!last || !last.durationSeconds || !Number.isFinite(last.durationSeconds))
    return null;
  const sourceTimeOffset = timeline.offsetSeconds - last.timelineStartSeconds;
  // Match getMediaTimelineEnd's arithmetic order: strict endpoint identity
  // must not depend on floating-point reassociation of a fractional offset.
  const globalEnd =
    last.timelineStartSeconds + last.durationSeconds - timeline.offsetSeconds;
  if (globalTime !== globalEnd) return null;
  return {
    clip: last,
    sourceTime: last.durationSeconds,
    sourceTimeOffset,
    globalEnd,
  };
};
