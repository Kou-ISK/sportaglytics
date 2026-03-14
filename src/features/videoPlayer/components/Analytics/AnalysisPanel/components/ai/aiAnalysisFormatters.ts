export const formatSeconds = (value: number): string => {
  if (!Number.isFinite(value)) return '--:--';
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  const gb = value / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = value / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
};

export const formatPercent = (value: number, digits: number = 1): string => {
  if (!Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(digits)}%`;
};

export const formatDurationShort = (value: number): string => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}秒`;
};

export const formatGapShort = (value: number): string => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 10) / 10;
  if (rounded >= 0) return `${rounded.toFixed(1)}秒`;
  return `${rounded.toFixed(1)}秒(重なり)`;
};

export const formatElapsed = (ms?: number): string => {
  if (!ms || !Number.isFinite(ms)) return '';
  return `${(ms / 1000).toFixed(1)}秒`;
};
