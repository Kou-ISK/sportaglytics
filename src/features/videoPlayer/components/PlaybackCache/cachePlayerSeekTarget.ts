/** Existing precision for confirming a stopped, decoded HTML image. */
export const CACHE_PLAYER_TIME_TOLERANCE_SECONDS = 0.002;

/** Container and HTML tracks can have distinct endpoints. Only a qualified
 * source's exact endpoint may use the existing image-confirmation precision;
 * arbitrary out-of-range requests keep the stricter rounding guard. This maps
 * the HTML adapter target, never the saved source clock or any field's PTS. */
export const resolveCachePlayerSeekTarget = (
  time: number,
  duration: number,
  sourceEnd?: number,
): number | null => {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(duration) ||
    time < 0 ||
    duration <= 0
  )
    return null;
  const endpoint = time === sourceEnd;
  const tolerance = endpoint ? CACHE_PLAYER_TIME_TOLERANCE_SECONDS : 0.000001;
  if (time - duration > tolerance) return null;
  return Math.min(time, duration);
};
