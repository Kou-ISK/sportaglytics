import { useContext, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type Player from 'video.js/dist/types/player';
import { CachePlayerContext } from './CachePlayerContext';
import type { CachePlayerPort } from './cachePlayerSwitch';
import { resolveVideoSource } from '../Player/SingleVideo/utils';
import {
  readCacheNativeAudio,
  restoreCacheNativeAudio,
} from './cacheNativeAudio';
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
        audio: readCacheNativeAudio(player.el()?.querySelector('video')),
      }),
      restore: (settings, count) => {
        player.volume(settings.volume);
        player.muted(settings.muted);
        player.playbackRate(settings.rate);
        restoreCacheNativeAudio(
          player.el()?.querySelector('video'),
          settings.audio,
          count,
        );
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
