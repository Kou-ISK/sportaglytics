interface ResolveControllerSeekTargetParams {
  baseTime: number;
  offset: number;
  useTimelineClock: boolean;
}

/**
 * Resolve the seek target applied by the shared playback controller.
 *
 * Virtual clip timelines already convert the global timeline position into a
 * clip-local position before mounting each player. Re-seeking those players
 * with a global time here would corrupt secondary-angle playback, so callers
 * must leave their currentTime untouched in timeline-clock mode.
 */
export const resolveControllerSeekTarget = ({
  baseTime,
  offset,
  useTimelineClock,
}: ResolveControllerSeekTargetParams): number | null => {
  if (useTimelineClock) {
    return null;
  }

  return Math.max(0, baseTime + offset);
};
