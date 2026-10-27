import type { IElectronAPI } from '../../../../renderer';
import { CachePlayerDurationError } from '../../components/PlaybackCache/cachePlayerDurationError';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
} from '../../../../types/ipc/nativePlayback';

// Stable local numeric codes; unknown errors become zero, never serialized text.
const reasons = [
  'NATIVE_RESPONSE_TIMEOUT',
  'NATIVE_OPEN_FAILED',
  'NATIVE_COMMAND_FAILED',
  'NATIVE_OBSERVATION_FAILED',
  'NATIVE_SURFACE_DETACHED',
  'NATIVE_STATE_LISTENER_FAILED',
  'NATIVE_INVALID_SEEK',
  'NATIVE_INVALID_COMMAND',
  'NATIVE_BIND_FAILED',
  'NATIVE_UNEXPECTED_CLOSE',
  'media',
  'protocol',
  'timeout',
  'owner',
  'cleanup',
  'NATIVE_RECOVERY_TIMEOUT',
  'NATIVE_ORIGINAL_PAUSE_FAILED',
  'NATIVE_CLEANUP_UNCONFIRMED',
  'NATIVE_STOP_CLOCK_UNCONFIRMED',
  'NATIVE_STOP_CLOCK_MISSING',
  'NATIVE_SOURCE_CHANGED',
  'NATIVE_ORIGINAL_PLAYING',
  'NATIVE_ORIGINAL_CANCELLED',
  'NATIVE_ORIGINAL_MEDIA_ERROR',
  'NATIVE_ORIGINAL_TIMEOUT',
  'NATIVE_ORIGINAL_DURATION',
  'NATIVE_ORIGINAL_INVALID',
  'NATIVE_RECOVERY_CHANGED',
  'CACHE_SWITCH_DURATION',
  'CACHE_SWITCH_TIMEOUT',
  'CACHE_SWITCH_MEDIA_ERROR',
  'CACHE_SWITCH_CANCELLED',
  'CACHE_SWITCH_PLAYING',
  'CACHE_SWITCH_FAILED',
  'CACHE_PLAYER_NOT_PAUSED',
  'CACHE_PLAYER_TIME',
];
export const reportNativeFailure = (
  api: IElectronAPI['nativePlayback'],
  owner: NativePlaybackOwner,
  intent: NativePlaybackIntent,
  confirmedTime: number,
  stage: 1 | 2,
  error: unknown,
): void => {
  try {
    const reason = error instanceof Error ? error.message : error;
    const code = typeof reason === 'string' ? reasons.indexOf(reason) + 1 : 0;
    void api
      .reportFailure?.(
        { ...owner },
        {
          stage,
          code,
          sequence: intent.sequence,
          seekId: intent.seekId,
          targetTime: intent.targetTime,
          confirmedTime,
          ...(error instanceof CachePlayerDurationError && error.recovery
            ? { recovery: error.recovery }
            : {}),
        },
      )
      .catch(() => {});
  } catch {
    /* Diagnostic failure never changes playback or recovery ownership. */
  }
};
