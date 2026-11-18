import { parseNativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import { CACHE_PLAYER_TIME_TOLERANCE_SECONDS } from '../../components/PlaybackCache/cachePlayerSeekTarget';
import { snapshotCachePlayer } from '../../components/PlaybackCache/cachePlayerSwitch';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import { NativePlaybackController } from './nativePlaybackController';
import type { NativePlaybackControls } from './nativePlaybackController';
import { restoreNativeGroupOriginal } from './nativeGroupOriginalRecovery';
import type { NativeGroupOriginal } from './nativeGroupOriginalRecovery';
import {
  bindNativePlayback,
  getNativePlayback,
} from './nativePlaybackRegistry';
import { claimNativePlayback } from './playbackAuthority';

/** First ordinary pair gateway: both original clips cover the complete package.
 * A partial-overlap or clip/gap timeline requires a different original-port
 * preparation transaction; never silently clamp those seeks to old sources. */
export const openQualifiedNativeGroupPlayback = (
  raw: NativePlaybackAvailability,
  players: ReadonlyMap<string, CachePlayerPort>,
  globalTime: number,
  pauseProduct: () => void,
  assertDocument: () => void,
  restored?: (time: number, controls: NativePlaybackControls) => void,
): NativePlaybackController => {
  const api = window.electronAPI?.nativePlayback;
  if (!api) throw Error('NATIVE_API_UNAVAILABLE');
  const availability = parseNativePlaybackAvailability(raw);
  const group = availability.group,
    presentation = availability.presentation;
  if (
    !availability.available ||
    !availability.owner ||
    !availability.sourceUrl ||
    availability.clockAuthority !== 'drawn-pair' ||
    !group ||
    !presentation ||
    availability.sourceEnd === null
  )
    throw Error('NATIVE_GROUP_UNQUALIFIED');
  const endTicks = Math.round(presentation.end * 120000);
  if (
    presentation.start !== 0 ||
    endTicks !== Math.round(availability.sourceEnd * 120000) ||
    group.angles.some(
      (angle) =>
        angle.globalStart !== 0 ||
        Math.round(angle.globalEnd * 120000) !== endTicks,
    )
  )
    throw Error('NATIVE_GROUP_TIMELINE_RECOVERY_REQUIRED');
  if (players.size !== 2 || getNativePlayback())
    throw Error('NATIVE_GROUP_PLAYERS');
  assertDocument();
  const originals = new Map<string, NativeGroupOriginal>();
  for (const angle of group.angles) {
    const port = players.get(angle.angleId);
    if (!port || port.source() !== angle.sourceUrl)
      throw Error('NATIVE_GROUP_PLAYER_CHANGED');
    const ready = port.ready();
    if (!Number.isInteger(ready) || ready < 2 || ready > 4)
      throw Error('NATIVE_GROUP_ORIGINAL_UNQUALIFIED');
    const snapshot = snapshotCachePlayer(port),
      settings = snapshot.settings;
    if (
      !settings.audio ||
      settings.audio.length !== angle.audioTracks ||
      settings.audio.filter(Boolean).length !== 1 ||
      settings.audio.some((value) => typeof value !== 'boolean') ||
      !Number.isFinite(settings.volume) ||
      settings.volume < 0 ||
      settings.volume > 1 ||
      typeof settings.muted !== 'boolean' ||
      Math.abs(snapshot.time - (globalTime + angle.sourceTimeOffset)) >
        CACHE_PLAYER_TIME_TOLERANCE_SECONDS ||
      (angle.angleId !== group.audioAngleId &&
        !settings.muted &&
        settings.volume > 0)
    )
      throw Error('NATIVE_GROUP_ORIGINAL_UNQUALIFIED');
    originals.set(angle.angleId, {
      port,
      snapshot: {
        ...snapshot,
        settings: { ...settings, audio: [...settings.audio] },
      },
    });
  }
  const audio = originals.get(group.audioAngleId);
  if (!audio?.snapshot.settings.audio)
    throw Error('NATIVE_GROUP_AUDIO_SELECTION');
  const saved = audio.snapshot.settings;
  const selectedAudio = saved.audio;
  if (!selectedAudio) throw Error('NATIVE_GROUP_AUDIO_SELECTION');
  const audioTrack = selectedAudio.findIndex(Boolean);
  if (
    [...originals.values()].some(
      (original) => original.snapshot.settings.rate !== saved.rate,
    ) ||
    !nativePresentationSupports(
      presentation,
      {
        targetTime: globalTime,
        rate: saved.rate,
        volume: saved.volume,
        muted: saved.muted,
        audioTrack,
      },
      audioTrack,
    )
  )
    throw Error('NATIVE_GROUP_OPERATION_USES_ORIGINAL');
  const check = (): void => {
    assertDocument();
    for (const angle of group.angles) {
      const captured = originals.get(angle.angleId);
      if (
        !captured ||
        players.get(angle.angleId) !== captured.port ||
        captured.port.source() !== angle.sourceUrl
      )
        throw Error('NATIVE_GROUP_PLAYER_CHANGED');
    }
  };
  check();
  const release = claimNativePlayback();
  let unbind: (() => void) | null = null;
  let initiallyPaused = false;
  let controller: NativePlaybackController;
  try {
    controller = new NativePlaybackController(
      api,
      availability.owner,
      availability.sourceUrl,
      globalTime,
      {
        playing: false,
        rate: saved.rate,
        volume: saved.volume,
        muted: saved.muted,
        audioTrack,
      },
      {
        restored,
        pause: () => {
          check();
          if (!initiallyPaused) {
            pauseProduct();
            initiallyPaused = true;
          }
          check();
          for (const original of originals.values()) {
            check();
            original.port.pause();
          }
        },
        restore: async (time, controls, signal) => {
          check();
          // Only the exact Main-qualified package endpoint maps to the Host's
          // canonical grid. Arbitrary out-of-range seeks are never clamped.
          const target =
            time === availability.sourceEnd ? presentation.end : time;
          await restoreNativeGroupOriginal(
            group,
            originals,
            target,
            controls,
            signal,
            check,
          );
          check();
        },
        release: () => {
          unbind?.();
          release();
        },
      },
      presentation,
      availability.clockAuthority,
    );
  } catch (error) {
    release();
    throw error;
  }
  try {
    unbind = bindNativePlayback(controller, group);
  } catch (error) {
    controller.fail('NATIVE_GROUP_BIND_FAILED');
    void controller.returnToOriginal().catch(() => {});
    throw error;
  }
  return controller;
};
