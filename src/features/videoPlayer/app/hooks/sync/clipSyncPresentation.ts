export const formatSyncTime = (seconds: number): string => {
  const value = Math.round(Math.abs(seconds) * 1000);
  const minutes = Math.floor(value / 60_000);
  const remainder = ((value % 60_000) / 1000).toFixed(3).padStart(6, '0');
  return `${seconds < 0 ? '−' : ''}${minutes.toString().padStart(2, '0')}:${remainder}`;
};
