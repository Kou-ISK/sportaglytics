import { restoreNativeOriginal } from './nativeOriginalRecovery';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import type { NativePlaybackControls } from './nativePlaybackController';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import { parseNativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import { NativePlaybackController } from './nativePlaybackController';
import { claimNativePlayback } from './playbackAuthority';
import {
  bindNativePlayback,
  getNativePlayback,
} from './nativePlaybackRegistry';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import { snapshotCachePlayer } from '../../components/PlaybackCache/cachePlayerSwitch';

/** The optional embedded UI calls this gateway. Main qualification is mandatory;
 * JS cannot provide an executable, source path, or media proof. */
export const openQualifiedNativePlayback = (
  raw: NativePlaybackAvailability,
  player: CachePlayerPort,
  pauseProduct: () => void,
  assertDocument: () => void,
  restored?: (time: number, controls: NativePlaybackControls) => void,
): NativePlaybackController => {
  const api = window.electronAPI?.nativePlayback;
  if (!api) throw Error('NATIVE_API_UNAVAILABLE');
  const availability = parseNativePlaybackAvailability(raw);
  if (
    !availability.available ||
    !availability.owner ||
    !availability.sourceUrl ||
    player.source() !== availability.sourceUrl
  )
    throw Error('NATIVE_UNQUALIFIED_PLAYER');
  assertDocument();
  const saved = snapshotCachePlayer(player);
  const audio = saved.settings.audio;
  if (
    !audio ||
    audio.length < 1 ||
    audio.length > 8 ||
    audio.filter(Boolean).length !== 1 ||
    (availability.presentation !== null &&
      audio.length !== availability.presentation.audioTracks)
  )
    throw Error('NATIVE_AUDIO_SELECTION_UNAVAILABLE');
  if (
    availability.presentation &&
    !nativePresentationSupports(
      availability.presentation,
      {
        targetTime: saved.time,
        rate: saved.settings.rate,
        volume: saved.settings.volume,
        muted: saved.settings.muted,
        audioTrack: audio.indexOf(true),
      },
      audio.indexOf(true),
    )
  )
    throw Error('NATIVE_OPERATION_USES_ORIGINAL');
  if (getNativePlayback()) throw Error('NATIVE_ALREADY_BOUND');
  const source = availability.sourceUrl;
  const release = claimNativePlayback();
  let unbind: (() => void) | null = null;
  let controller: NativePlaybackController;
  let initiallyPaused = false;
  try {
    controller = new NativePlaybackController(
      api,
      availability.owner,
      source,
      saved.time,
      {
        playing: false,
        rate: saved.settings.rate,
        volume: saved.settings.volume,
        muted: saved.settings.muted,
        audioTrack: audio.indexOf(true),
      },
      {
        restored,
        pause: () => {
          if (!initiallyPaused) {
            pauseProduct();
            initiallyPaused = true;
          }
          player.pause();
        },
        restore: async (time, controls, signal) => {
          assertDocument();
          if (player.source() !== source) throw Error('NATIVE_SOURCE_CHANGED');
          const check = (): void => {
            assertDocument();
            signal.throwIfAborted();
          };
          const guardedPlayer: CachePlayerPort = {
            ...player,
            setSource: (value) => {
              check();
              player.setSource(value);
            },
            seek: (value) => {
              check();
              player.seek(value);
            },
            restore: (settings, count) => {
              check();
              player.restore(settings, count);
            },
          };
          await restoreNativeOriginal(
            guardedPlayer,
            source,
            {
              time,
              sourceEnd: availability.sourceEnd ?? undefined,
              settings: {
                volume: controls.volume,
                muted: controls.muted,
                rate: controls.rate,
                audio: audio.map((_, index) => index === controls.audioTrack),
              },
            },
            audio.length,
            signal,
            player,
          );
          assertDocument();
          if (player.source() !== source || !player.paused())
            throw Error('NATIVE_RECOVERY_CHANGED');
        },
        release: () => {
          unbind?.();
          release();
        },
      },
      availability.presentation,
    );
  } catch (error) {
    // Construction can fail while pausing HTML, before any native open/timer.
    release();
    throw error;
  }
  try {
    unbind = bindNativePlayback(controller);
  } catch (error) {
    // Keep the lease if a reentrant registration races the pause callback.
    // The queued open is cancelled, but release still requires stopped recovery.
    controller.fail('NATIVE_BIND_FAILED');
    void controller.returnToOriginal().catch(() => {});
    throw error;
  }
  return controller;
};
