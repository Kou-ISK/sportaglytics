import { useContext, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type Player from 'video.js/dist/types/player';
import { CachePlayerContext } from './CachePlayerContext';
import type { CachePlayerPort } from './cachePlayerSwitch';
import { resolveVideoSource } from '../Player/SingleVideo/utils';

// Chromium does not expose native audioTracks on every build. Multiple tracks
// require that capability; an empty/emulated list must not imply preservation.
interface NativeAudioTrack {
  enabled: boolean;
}
const audioTracks = (player: Player): NativeAudioTrack[] | null => {
  const element = player.el()?.querySelector('video');
  if (!element || !('audioTracks' in element)) return null;
  const list = element.audioTracks;
  if (
    !list ||
    typeof list !== 'object' ||
    !('length' in list) ||
    typeof list.length !== 'number' ||
    !Number.isSafeInteger(list.length) ||
    list.length > 8
  )
    return null;
  const result: NativeAudioTrack[] = [];
  for (let index = 0; index < list.length; index++) {
    const item: unknown = Reflect.get(list, index);
    if (
      !item ||
      typeof item !== 'object' ||
      !('enabled' in item) ||
      typeof item.enabled !== 'boolean'
    )
      return null;
    // The native object's enabled field is explicitly checked above.
    result.push(item as NativeAudioTrack);
  }
  return result;
};
export const useCachePlayerRegistration = (
  playerRef: MutableRefObject<Player | null>,
  videoSrc: string,
  isReady: boolean,
): MutableRefObject<boolean> => {
  const context = useContext(CachePlayerContext);
  const suppressMetadata = useRef(false);
  useEffect(() => {
    const player = playerRef.current;
    if (!context || !player || !isReady) return;
    const port: CachePlayerPort = {
      paused: () => player.paused(),
      time: () => player.currentTime() ?? 0,
      duration: () => player.duration() ?? NaN,
      ready: () => player.readyState(),
      seeking: () => player.seeking(),
      source: () => player.el()?.querySelector('video')?.currentSrc ?? '',
      setSource: (src) => player.src({ src, type: 'video/mp4' }),
      seek: (time) => player.currentTime(time),
      pause: () => {
        if (!player.isDisposed()) player.pause();
      },
      settings: () => ({
        volume: player.volume() ?? 1,
        muted: player.muted() ?? false,
        rate: player.playbackRate() ?? 1,
        audio: audioTracks(player)?.map((track) => track.enabled) ?? null,
      }),
      restore: (settings, count) => {
        player.volume(settings.volume);
        player.muted(settings.muted);
        player.playbackRate(settings.rate);
        const tracks = audioTracks(player);
        if (
          count > 1 &&
          (!tracks ||
            !settings.audio ||
            tracks.length !== count ||
            settings.audio.length !== count)
        )
          throw Error('CACHE_AUDIO_SELECTION_UNAVAILABLE');
        if (tracks && settings.audio && tracks.length === settings.audio.length)
          tracks.forEach((track, index) => {
            track.enabled = settings.audio?.[index] ?? false;
          });
      },
      on: (event, callback) => {
        player.on(event, callback);
      },
      off: (event, callback) => {
        if (!player.isDisposed()) player.off(event, callback);
      },
    };
    return context.register({
      source: resolveVideoSource(videoSrc).src,
      port,
      suppressMetadata: (value) => {
        suppressMetadata.current = value;
      },
    });
  }, [context, isReady, playerRef, videoSrc]);
  return suppressMetadata;
};
