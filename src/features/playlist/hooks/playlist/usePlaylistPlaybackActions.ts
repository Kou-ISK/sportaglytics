import { useCallback } from 'react';
import type React from 'react';
import type {
  PlaylistPlaybackActions,
  UsePlaylistPlaybackParams,
} from './usePlaylistPlayback.types';

interface UsePlaylistPlaybackActionsParams extends Pick<
  UsePlaylistPlaybackParams,
  | 'items'
  | 'currentItem'
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
  | 'minFreezeDuration'
> {
  lastFreezeTimestampRef: React.MutableRefObject<number | null>;
  freezeTimeoutRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
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
  currentItem,
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
  minFreezeDuration,
  lastFreezeTimestampRef,
  freezeTimeoutRef,
}: UsePlaylistPlaybackActionsParams): PlaylistPlaybackActions => {
  const clearFreezeTimer = useCallback((): void => {
    if (freezeTimeoutRef.current) {
      clearTimeout(freezeTimeoutRef.current);
      freezeTimeoutRef.current = null;
    }
  }, [freezeTimeoutRef]);

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
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
      freezeTimeoutRef.current = setTimeout(() => {
        setIsFrozen(false);
        setIsPlaying(true);
        freezeTimeoutRef.current = null;
      }, duration * 1000);
    },
    [
      freezeTimeoutRef,
      isFrozen,
      minFreezeDuration,
      setIsFrozen,
      setIsPlaying,
      videoRef,
      videoRef2,
    ],
  );

  const handleItemEnd = useCallback(() => {
    lastFreezeTimestampRef.current = null;
    clearFreezeTimer();
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
    clearFreezeTimer,
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
          clearFreezeTimer();
          const item = items[index];
          if (videoRef.current) videoRef.current.currentTime = item.startTime;
          if (videoRef2.current && currentVideoSource2) {
            videoRef2.current.currentTime = item.startTime;
          }
          setCurrentIndex(index);
          setIsFrozen(false);
          setIsPlaying(true);
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
    [
      currentIndex,
      clearFreezeTimer,
      currentVideoSource2,
      items,
      setCurrentIndex,
      setIsFrozen,
      setIsPlaying,
      videoRef,
      videoRef2,
    ],
  );

  const handleTogglePlay = useCallback(() => {
    if (isFrozen) {
      clearFreezeTimer();
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
  }, [
    clearFreezeTimer,
    currentIndex,
    isFrozen,
    isPlaying,
    items.length,
    setCurrentIndex,
    setIsFrozen,
    setIsPlaying,
  ]);

  const handlePrevious = useCallback(() => {
    clearFreezeTimer();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(items.length - 1);
      setIsPlaying(true);
    }
  }, [
    clearFreezeTimer,
    currentIndex,
    items.length,
    loopPlaylist,
    setCurrentIndex,
    setIsPlaying,
  ]);

  const handleNext = useCallback(() => {
    clearFreezeTimer();
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [
    clearFreezeTimer,
    currentIndex,
    items.length,
    loopPlaylist,
    setCurrentIndex,
    setIsPlaying,
  ]);

  const handleSeek = useCallback(
    (event: Event, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value;
      const clampedTime = currentItem
        ? Math.min(currentItem.endTime, Math.max(currentItem.startTime, time))
        : Math.max(0, time);
      if (videoRef.current) {
        videoRef.current.currentTime = clampedTime;
      }
      if (videoRef2.current && currentVideoSource2) {
        videoRef2.current.currentTime = clampedTime;
      }
      lastFreezeTimestampRef.current = null;
      clearFreezeTimer();
      setIsFrozen(false);
      blurFocusTargets(event);
    },
    [
      clearFreezeTimer,
      currentItem,
      currentVideoSource2,
      lastFreezeTimestampRef,
      setIsFrozen,
      videoRef,
      videoRef2,
    ],
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
