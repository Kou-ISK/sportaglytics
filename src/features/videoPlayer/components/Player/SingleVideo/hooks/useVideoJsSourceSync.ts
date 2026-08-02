import { useEffect } from 'react';
import type Player from 'video.js/dist/types/player';
import { resolveVideoSource } from '../utils';

interface UseVideoJsSourceSyncParams {
  id: string;
  videoSrc: string;
  playerRef: React.MutableRefObject<Player | null>;
  setIsReady: (value: boolean) => void;
  setDurationSec: (value: number) => void;
  lastReportedAspectRatioRef: React.MutableRefObject<number | null>;
}

export const useVideoJsSourceSync = ({
  id,
  videoSrc,
  playerRef,
  setIsReady,
  setDurationSec,
  lastReportedAspectRatioRef,
}: UseVideoJsSourceSyncParams) => {
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoSrc) {
      return;
    }

    const source = resolveVideoSource(videoSrc);
    let currentSource = '';
    try {
      const value = player.currentSource?.();
      if (value && typeof value === 'object' && 'src' in value) {
        currentSource = (value as { src?: string }).src ?? '';
      }
    } catch {
      currentSource = '';
    }

    if (currentSource === source.src) {
      return;
    }

    lastReportedAspectRatioRef.current = null;
    setIsReady(false);
    setDurationSec(0);
    player.pause();
    player.src(source);
  }, [
    id,
    lastReportedAspectRatioRef,
    playerRef,
    setDurationSec,
    setIsReady,
    videoSrc,
  ]);
};
