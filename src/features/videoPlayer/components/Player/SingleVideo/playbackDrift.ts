export const PLAYBACK_DRIFT_THRESHOLD_SECONDS = 0.25;
export const PLAYBACK_DRIFT_CORRECTION_COOLDOWN_MS = 750;

export const resolvePlaybackDriftCorrectionTarget = ({
  actualTimeSeconds,
  targetTimeSeconds,
  durationSeconds,
  thresholdSeconds = PLAYBACK_DRIFT_THRESHOLD_SECONDS,
}: {
  actualTimeSeconds: number;
  targetTimeSeconds: number | null;
  durationSeconds: number;
  thresholdSeconds?: number;
}): number | null => {
  if (
    targetTimeSeconds === null ||
    !Number.isFinite(targetTimeSeconds) ||
    !Number.isFinite(actualTimeSeconds) ||
    targetTimeSeconds < 0 ||
    actualTimeSeconds < 0
  ) {
    return null;
  }

  if (
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    targetTimeSeconds >= durationSeconds
  ) {
    return null;
  }

  return Math.abs(actualTimeSeconds - targetTimeSeconds) >= thresholdSeconds
    ? targetTimeSeconds
    : null;
};
