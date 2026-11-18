import type {
  CachePlayerPort,
  CachePlayerSnapshot,
} from '../../components/PlaybackCache/cachePlayerSwitch';
import { CACHE_PLAYER_TIME_TOLERANCE_SECONDS } from '../../components/PlaybackCache/cachePlayerSeekTarget';
import type { NativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import { parseNativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import type { NativePlaybackControls } from './nativePlaybackController';
import { restoreNativeOriginal } from './nativeOriginalRecovery';

export interface NativeGroupOriginal {
  readonly port: CachePlayerPort;
  readonly snapshot: CachePlayerSnapshot;
}
/** Restore both captured original ports before returning playback authority.
 * Existing browser seeks cannot be physically cancelled: failure aborts only
 * this attempt's listeners/new mutations and retains the caller's lease. */
export const restoreNativeGroupOriginal = async (
  rawBinding: NativePlaybackGroupBinding,
  originals: ReadonlyMap<string, NativeGroupOriginal>,
  globalTime: number,
  controls: NativePlaybackControls,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<void> => {
  const binding = parseNativePlaybackGroupBinding(rawBinding);
  if (
    !Number.isFinite(globalTime) ||
    controls.playing ||
    !Number.isFinite(controls.rate) ||
    controls.rate <= 0 ||
    !Number.isFinite(controls.volume) ||
    controls.volume < 0 ||
    controls.volume > 1 ||
    typeof controls.muted !== 'boolean'
  )
    throw Error('NATIVE_GROUP_ORIGINAL_CONTROLS');
  const check = (): void => {
    signal.throwIfAborted();
    assertCurrent();
  };
  check();
  if (originals.size !== 2) throw Error('NATIVE_GROUP_ORIGINAL_PORTS');
  // Validate both members before mutating either. Never clamp a requested
  // package time into an unrelated clip or silently restore only one angle.
  const slots = binding.angles.map((angle) => {
    const original = originals.get(angle.angleId);
    if (
      !original ||
      original.port.source() !== angle.sourceUrl ||
      globalTime < angle.globalStart ||
      globalTime > angle.globalEnd
    )
      throw Error('NATIVE_GROUP_ORIGINAL_SOURCE');
    const baseline = original.snapshot.settings;
    if (
      !Number.isFinite(baseline.volume) ||
      baseline.volume < 0 ||
      baseline.volume > 1 ||
      typeof baseline.muted !== 'boolean'
    )
      throw Error('NATIVE_GROUP_ORIGINAL_CONTROLS');
    const audio = baseline.audio;
    if (
      !audio ||
      audio.length !== angle.audioTracks ||
      audio.some((value) => typeof value !== 'boolean') ||
      audio.filter(Boolean).length !== 1
    )
      throw Error('NATIVE_GROUP_ORIGINAL_AUDIO');
    const selected = angle.angleId === binding.audioAngleId;
    if (
      selected &&
      (!Number.isInteger(controls.audioTrack) ||
        controls.audioTrack < 0 ||
        controls.audioTrack >= angle.audioTracks)
    )
      throw Error('NATIVE_GROUP_ORIGINAL_AUDIO');
    const sourceEnd =
      (Math.round(angle.globalEnd * 120000) +
        Math.round(angle.sourceTimeOffset * 120000)) /
      120000;
    const time =
      globalTime === angle.globalEnd
        ? sourceEnd
        : globalTime + angle.sourceTimeOffset;
    if (!Number.isFinite(time) || time < 0 || time > angle.sourceEnd)
      throw Error('NATIVE_GROUP_ORIGINAL_RANGE');
    const settings = {
      ...original.snapshot.settings,
      rate: controls.rate,
      ...(selected ? { volume: controls.volume, muted: controls.muted } : {}),
      audio: selected
        ? audio.map((_, index) => index === controls.audioTrack)
        : [...audio],
    };
    if (!selected && !settings.muted && settings.volume > 0)
      throw Error('NATIVE_GROUP_ORIGINAL_MULTIPLE_AUDIO');
    return {
      angle,
      original: { port: original.port },
      time,
      settings,
      sourceEnd,
    };
  });
  const abort = new AbortController();
  const cancelled = (): void => abort.abort(signal.reason);
  signal.addEventListener('abort', cancelled, { once: true });
  let failed = false,
    failure: unknown;
  try {
    check();
    const pending = slots.map(
      ({ angle, original, time, settings, sourceEnd }) => {
        const guarded = (): void => {
          check();
          abort.signal.throwIfAborted();
          if (original.port.source() !== angle.sourceUrl)
            throw Error('NATIVE_GROUP_ORIGINAL_SOURCE');
        };
        const port: CachePlayerPort = {
          ...original.port,
          pause: () => {
            guarded();
            original.port.pause();
          },
          seek: (value) => {
            guarded();
            original.port.seek(value);
          },
          setSource: (value) => {
            guarded();
            original.port.setSource(value);
          },
          restore: (value, count) => {
            guarded();
            original.port.restore(value, count);
          },
        };
        return Promise.resolve()
          .then(() =>
            restoreNativeOriginal(
              port,
              angle.sourceUrl,
              { time, settings, sourceEnd },
              angle.audioTracks,
              abort.signal,
              original.port,
            ),
          )
          .catch((error: unknown) => {
            if (!failed) {
              failed = true;
              failure = error;
            }
            abort.abort(error);
            throw error;
          });
      },
    );
    await Promise.allSettled(pending);
    if (failed) throw failure;
    check();
    for (const { angle, original, time } of slots) {
      const actualTime = original.port.time(),
        ready = original.port.ready();
      if (
        original.port.source() !== angle.sourceUrl ||
        !original.port.paused() ||
        original.port.seeking() ||
        !Number.isInteger(ready) ||
        ready < 2 ||
        ready > 4 ||
        !Number.isFinite(actualTime) ||
        Math.abs(actualTime - time) > CACHE_PLAYER_TIME_TOLERANCE_SECONDS
      )
        throw Error('NATIVE_GROUP_ORIGINAL_UNCONFIRMED');
    }
  } finally {
    signal.removeEventListener('abort', cancelled);
  }
};
