import {
  resolveCachePlayerSeekTarget,
  CACHE_PLAYER_TIME_TOLERANCE_SECONDS,
} from './cachePlayerSeekTarget';
import { CachePlayerDurationError } from './cachePlayerDurationError';
/** Media adapter keeps this transaction independent of React and Video.js. */
export interface CachePlayerPort {
  paused: () => boolean;
  time: () => number;
  duration: () => number;
  ready: () => number;
  seeking: () => boolean;
  source: () => string;
  setSource: (source: string) => void;
  seek: (time: number) => void;
  pause: () => void;
  settings: () => {
    volume: number;
    muted: boolean;
    rate: number;
    audio: boolean[] | null;
  };
  restore: (
    settings: ReturnType<CachePlayerPort['settings']>,
    audioTracks: number,
  ) => void;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
}
export interface CachePlayerSnapshot {
  time: number;
  /** Validated native source endpoint, absent for ordinary cache switching. */
  sourceEnd?: number;
  settings: ReturnType<CachePlayerPort['settings']>;
}
export const snapshotCachePlayer = (
  port: CachePlayerPort,
): CachePlayerSnapshot => {
  if (!port.paused() || port.seeking() || port.ready() < 2)
    throw Error('CACHE_PLAYER_NOT_PAUSED');
  const snapshot = { time: port.time(), settings: port.settings() };
  if (!Number.isFinite(snapshot.time) || snapshot.time < 0)
    throw Error('CACHE_PLAYER_TIME');
  return snapshot;
};
/** Resolve only after a decoded frame at the saved media time is available.
 * Timeout is a failure bound, never an artificial playback delay. */
export const switchCachePlayer = (
  port: CachePlayerPort,
  source: string,
  snapshot: CachePlayerSnapshot,
  audioTracks: number,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Error('CACHE_SWITCH_CANCELLED'));
      return;
    }
    let settled = false;
    let metadata = false;
    let reset = false;
    let sought = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const [event, listener] of listeners) port.off(event, listener);
      signal.removeEventListener('abort', aborted);
      if (error) {
        port.pause();
        reject(error);
      } else resolve();
    };
    const check = (metadataEvent = false): void => {
      if (settled || port.source() !== source) return;
      try {
        if (!port.paused()) throw Error('CACHE_SWITCH_PLAYING');
        if (!metadata && reset && metadataEvent === true && port.ready() >= 1) {
          const duration = port.duration();
          const targetTime = resolveCachePlayerSeekTarget(
            snapshot.time,
            duration,
            snapshot.sourceEnd,
          );
          if (targetTime === null)
            throw new CachePlayerDurationError(
              'CACHE_SWITCH_DURATION',
              snapshot.time,
              duration,
              port.ready(),
              port.seeking(),
            );
          port.restore(snapshot.settings, audioTracks);
          metadata = true;
          // Mark before seek: adapters may dispatch synchronously.
          sought = true;
          port.seek(targetTime);
        }
        if (
          sought &&
          !port.seeking() &&
          port.ready() >= 2 &&
          Math.abs(port.time() - snapshot.time) <=
            CACHE_PLAYER_TIME_TOLERANCE_SECONDS
        )
          finish();
      } catch (error) {
        finish(error instanceof Error ? error : Error('CACHE_SWITCH_FAILED'));
      }
    };
    const failed = (): void => finish(Error('CACHE_SWITCH_MEDIA_ERROR'));
    const played = (): void => finish(Error('CACHE_SWITCH_PLAYING'));
    const aborted = (): void => finish(Error('CACHE_SWITCH_CANCELLED'));
    const listeners: [string, () => void][] = [
      [
        'emptied',
        () => {
          reset = true;
        },
      ],
      [
        'loadstart',
        () => {
          if (port.ready() === 0) reset = true;
        },
      ],
      ['loadedmetadata', () => check(true)],
      ['loadeddata', check],
      ['seeked', check],
      ['canplay', check],
      ['error', failed],
      ['play', played],
      ['dispose', aborted],
    ];
    for (const [event, listener] of listeners) port.on(event, listener);
    signal.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => finish(Error('CACHE_SWITCH_TIMEOUT')), 15000);
    try {
      port.pause();
      port.setSource(source);
    } catch {
      failed();
    }
  });
