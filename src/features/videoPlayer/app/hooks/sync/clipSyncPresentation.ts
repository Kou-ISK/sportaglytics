export const formatSyncTime = (seconds: number): string => {
  const value = Math.round(Math.abs(seconds) * 1000);
  const minutes = Math.floor(value / 60_000);
  const remainder = ((value % 60_000) / 1000).toFixed(3).padStart(6, '0');
  return `${seconds < 0 ? '−' : ''}${minutes.toString().padStart(2, '0')}:${remainder}`;
};

/** Reference-local interval where both selected sources contain a frame. */
export const getClipSyncOverlap = (
  referenceDuration: number,
  targetDuration: number,
  targetTimeDelta: number,
): { start: number; end: number } | null => {
  const start = Math.max(0, -targetTimeDelta);
  const end = Math.min(referenceDuration, targetDuration - targetTimeDelta);
  return end > start ? { start, end } : null;
};
