import { useCallback } from 'react';
import type React from 'react';
import type { PlaylistPlaybackActions, UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

interface UsePlaylistPlaybackActionsParams
  extends Pick<
    UsePlaylistPlaybackParams,
    | 'items'
    | 'currentIndex'
    | 'setCurrentIndex'
    | 'isPlaying'
    | 'setIsPlaying'
    | 'isFrozen'
    | 'setIsFrozen'
    | 'autoAdvance'
    | 'loopPlaylist'
    | 'currentVideoSource2'
    | 'videoRef'
    | 'videoRef2'
    | 'setVolume'
    | 'containerRef'
    | 'isFullscreen'
    | 'setIsFullscreen'
    | 'setIsDrawingMode'
    | 'minFreezeDuration'
  > {
  lastFreezeTimestampRef: React.MutableRefObject<number | null>;
}

const blurFocusTargets = (event: Event) => {
  if (event.target && 'blur' in event.target) {
    (event.target as HTMLElement).blur();
  }
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

export const usePlaylistPlaybackActions = ({
  items,
  currentIndex,
  setCurrentIndex,
  isPlaying,
  setIsPlaying,
  isFrozen,
  setIsFrozen,
  autoAdvance,
  loopPlaylist,
  currentVideoSource2,
  videoRef,
  videoRef2,
  setVolume,
  containerRef,
  isFullscreen,
  setIsFullscreen,
  setIsDrawingMode,
  minFreezeDuration,
  lastFreezeTimestampRef,
}: UsePlaylistPlaybackActionsParams): PlaylistPlaybackActions => {
  const triggerFreezeFrame = useCallback(
    (freezeDuration: number) => {
      const duration = Math.max(minFreezeDuration, freezeDuration);
      if (isFrozen || duration <= 0) return;

      const video = videoRef.current;
      const video2 = videoRef2.current;

      video?.pause();
      video2?.pause();
      setIsFrozen(true);
      setIsPlaying(false);
    },
    [isFrozen, minFreezeDuration, setIsFrozen, setIsPlaying, videoRef, videoRef2],
  );

  const handleItemEnd = useCallback(() => {
    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);

    if (!autoAdvance) {
      setIsPlaying(false);
      return;
    }
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
    }
  }, [
    autoAdvance,
    currentIndex,
    items.length,
    lastFreezeTimestampRef,
    loopPlaylist,
    setCurrentIndex,
    setIsFrozen,
    setIsPlaying,
  ]);

  const handlePlayItem = useCallback(
    (id?: string) => {
      if (id) {
        const index = items.findIndex((item) => item.id === id);
        if (index !== -1) {
          setCurrentIndex(index);
          setIsPlaying(true);
          setIsDrawingMode(false);
        }
        return;
      }
      if (currentIndex >= 0) {
        setIsPlaying(true);
      } else if (items.length > 0) {
        setCurrentIndex(0);
        setIsPlaying(true);
      }
    },
    [currentIndex, items, setCurrentIndex, setIsDrawingMode, setIsPlaying],
  );

  const handleTogglePlay = useCallback(() => {
    if (isFrozen) {
      setIsFrozen(false);
      setIsPlaying(true);
      return;
    }

    if (currentIndex < 0 && items.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [currentIndex, isFrozen, isPlaying, items.length, setCurrentIndex, setIsFrozen, setIsPlaying]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(items.length - 1);
      setIsPlaying(true);
    }
  }, [currentIndex, items.length, loopPlaylist, setCurrentIndex, setIsPlaying]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [currentIndex, items.length, loopPlaylist, setCurrentIndex, setIsPlaying]);

  const handleSeek = useCallback(
    (event: Event, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value;
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      if (videoRef2.current && currentVideoSource2) {
        videoRef2.current.currentTime = time;
      }
      lastFreezeTimestampRef.current = null;
      setIsFrozen(false);
      blurFocusTargets(event);
    },
    [currentVideoSource2, lastFreezeTimestampRef, setIsFrozen, videoRef, videoRef2],
  );

  const handleVolumeChange = useCallback(
    (_: Event, value: number | number[]) => {
      const next = Array.isArray(value) ? value[0] : value;
      if (Number.isFinite(next)) {
        setVolume(next);
      }
    },
    [setVolume],
  );

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [containerRef, isFullscreen, setIsFullscreen]);

  return {
    handlePlayItem,
    handleTogglePlay,
    handlePrevious,
    handleNext,
    handleSeek,
    handleVolumeChange,
    handleToggleFullscreen,
    triggerFreezeFrame,
    handleItemEnd,
  };
};
