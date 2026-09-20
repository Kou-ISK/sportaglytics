/** Move relative to the displayed frame, including when a scrub stopped between PTS values. */
export const adjacentSyncFrame = (
  times: readonly number[],
  time: number,
  direction: -1 | 1,
): number | undefined => {
  const current = times.findLastIndex((value) => value <= time + 0.0005);
  return times[current + direction];
};
