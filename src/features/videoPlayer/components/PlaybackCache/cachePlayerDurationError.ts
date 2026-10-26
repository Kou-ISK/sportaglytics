import type { NativePlaybackRecoveryContext } from '../../../../types/ipc/nativePlaybackFailure';

/** Preserve only the numeric values used by a failed duration guard. */
export class CachePlayerDurationError extends Error {
  readonly recovery: NativePlaybackRecoveryContext | undefined;

  constructor(
    code: 'NATIVE_ORIGINAL_DURATION' | 'CACHE_SWITCH_DURATION',
    requestedTime: number,
    duration: number,
    readyState: number,
    seeking: boolean,
  ) {
    super(code);
    const durationKind = Number.isNaN(duration)
      ? 1
      : duration === Infinity
        ? 2
        : duration === -Infinity
          ? 3
          : Math.abs(duration) > 86400
            ? 4
            : 0;
    this.recovery =
      Number.isFinite(requestedTime) &&
      requestedTime >= 0 &&
      requestedTime <= 86400
        ? {
            requestedTime,
            duration: durationKind === 0 ? duration : 0,
            durationKind,
            readyState:
              Number.isInteger(readyState) && readyState >= 0 && readyState <= 4
                ? readyState
                : 5,
            seeking: seeking ? 1 : 0,
          }
        : undefined;
  }
}
