import type {
  CachePlayerPort,
  CachePlayerSnapshot,
} from '../../components/PlaybackCache/cachePlayerSwitch';
import { switchCachePlayer } from '../../components/PlaybackCache/cachePlayerSwitch';
import {
  resolveCachePlayerSeekTarget,
  CACHE_PLAYER_TIME_TOLERANCE_SECONDS,
} from '../../components/PlaybackCache/cachePlayerSeekTarget';
import { CachePlayerDurationError } from '../../components/PlaybackCache/cachePlayerDurationError';
const requestedSeeks = new WeakMap<
  CachePlayerPort,
  { source: string; time: number }
>();

/** Native never replaces the HTML source. Reuse its metadata/decoder instead
 * of reopening a long file for every fallback or superseding scrub target. */
export const restoreNativeOriginal = (
  port: CachePlayerPort,
  source: string,
  snapshot: CachePlayerSnapshot,
  audioTracks: number,
  signal: AbortSignal,
  // Per-attempt guards may wrap a stable player; preserve that underlying identity.
  identity: CachePlayerPort = port,
): Promise<void> => {
  if (port.source() !== source)
    return Promise.reject(Error('NATIVE_SOURCE_CHANGED'));
  if (port.ready() < 1) {
    requestedSeeks.delete(identity);
    return switchCachePlayer(port, source, snapshot, audioTracks, signal);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      for (const [name, listener] of listeners) port.off(name, listener);
      if (error) reject(error);
      else resolve();
    };
    const check = (): void => {
      try {
        if (port.source() !== source) throw Error('NATIVE_SOURCE_CHANGED');
        if (!port.paused()) throw Error('NATIVE_ORIGINAL_PLAYING');
        if (
          !port.seeking() &&
          port.ready() >= 2 &&
          Math.abs(port.time() - snapshot.time) <=
            CACHE_PLAYER_TIME_TOLERANCE_SECONDS
        )
          finish();
      } catch (error) {
        finish(
          error instanceof Error ? error : Error('NATIVE_ORIGINAL_INVALID'),
        );
      }
    };
    const abort = (): void => finish(Error('NATIVE_ORIGINAL_CANCELLED'));
    const failed = (): void => finish(Error('NATIVE_ORIGINAL_MEDIA_ERROR'));
    const listeners: [string, () => void][] = [
      ['seeked', check],
      ['loadeddata', check],
      ['canplay', check],
      ['error', failed],
      ['play', check],
      ['emptied', failed],
      ['dispose', abort],
    ];
    if (signal.aborted) {
      abort();
      return;
    }
    for (const [name, listener] of listeners) port.on(name, listener);
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(Error('NATIVE_ORIGINAL_TIMEOUT')), 15000);
    try {
      port.pause();
      const duration = port.duration();
      const targetTime = resolveCachePlayerSeekTarget(
        snapshot.time,
        duration,
        snapshot.sourceEnd,
      );
      if (targetTime === null)
        throw new CachePlayerDurationError(
          'NATIVE_ORIGINAL_DURATION',
          snapshot.time,
          duration,
          port.ready(),
          port.seeking(),
        );
      port.restore(snapshot.settings, audioTracks);
      const requested = requestedSeeks.get(identity);
      // Replacing only settings must not restart the same decoder seek. Keep
      // waiting for its real seeked/ready event; never reuse a different target.
      if (
        requested?.source !== source ||
        requested.time !== targetTime ||
        Math.abs(port.time() - targetTime) > 0.002
      ) {
        requestedSeeks.set(identity, { source, time: targetTime });
        port.seek(targetTime);
      }
      check();
    } catch (error) {
      finish(error instanceof Error ? error : Error('NATIVE_ORIGINAL_INVALID'));
    }
  });
};
