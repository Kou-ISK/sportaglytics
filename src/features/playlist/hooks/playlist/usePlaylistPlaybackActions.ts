import { useCallback, useRef } from 'react';
import type React from 'react';
import type {
  PlaylistPlaybackActions,
  UsePlaylistPlaybackParams,
} from './usePlaylistPlayback.types';

interface UsePlaylistPlaybackActionsParams extends Pick<
  UsePlaylistPlaybackParams,
  | 'items'
  | 'documentGeneration'
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
  seekMedia?: (time: number) => boolean;
  setCurrentTime?: React.Dispatch<React.SetStateAction<number>>;
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
  documentGeneration,
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
  setCurrentTime,
  seekMedia,
}: UsePlaylistPlaybackActionsParams): PlaylistPlaybackActions => {
  const rowScope = useRef<{ ids: ReadonlySet<string>; generation?: number } | null>(null);
  const adjacentIndex = useCallback((step: 1 | -1): number => {
    const scope = rowScope.current;
    const isScoped = scope && scope.generation === documentGeneration;
    const indices = items.flatMap((item, index) =>
      !isScoped || scope.ids.has(item.id) ? [index] : [],
    );
    const position = indices.indexOf(currentIndex);
    if (isScoped && position < 0) return -1;
    const adjacent = indices[position + step];
    if (adjacent !== undefined) return adjacent;
    return loopPlaylist ? (step === 1 ? indices[0] : indices.at(-1)) ?? -1 : -1;
  }, [currentIndex, documentGeneration, items, loopPlaylist]);

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
      return false;
    }
    const next = adjacentIndex(1);
    if (next >= 0) setCurrentIndex(next);
    else setIsPlaying(false);
    return next >= 0 && next === currentIndex;
  }, [
    autoAdvance,
    currentIndex,
    adjacentIndex,
    lastFreezeTimestampRef,
    clearFreezeTimer,
    setCurrentIndex,
    setIsFrozen,
    setIsPlaying,
  ]);

  const handlePlayItem = useCallback(
    (id?: string) => {
      rowScope.current = null;
      if (id) {
        const index = items.findIndex((item) => item.id === id);
        if (index !== -1) {
          clearFreezeTimer();
          const item = items[index];
          if (!item.slide && !seekMedia?.(item.startTime)) {
            if (videoRef.current) videoRef.current.currentTime = item.startTime;
            if (videoRef2.current && currentVideoSource2)
              videoRef2.current.currentTime = item.startTime;
          }
          setCurrentIndex(index);
          setCurrentTime?.(item.startTime);
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
      setCurrentTime,
      seekMedia,
      setIsFrozen,
      setIsPlaying,
      videoRef,
      videoRef2,
    ],
  );

  const handlePlayRow = useCallback((ids: readonly string[]): void => {
    const members = new Set(ids);
    const first = items.find((item) => members.has(item.id));
    if (!first) return;
    handlePlayItem(first.id);
    rowScope.current = { ids: members, generation: documentGeneration };
  }, [items, handlePlayItem, documentGeneration]);

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

  const stepItem = useCallback((step: 1 | -1): void => {
    clearFreezeTimer();
    const index = adjacentIndex(step);
    if (index >= 0) {
      setCurrentIndex(index);
      setIsPlaying(true);
    }
  }, [adjacentIndex, clearFreezeTimer, setCurrentIndex, setIsPlaying]);
  const handlePrevious = useCallback(() => stepItem(-1), [stepItem]);
  const handleNext = useCallback(() => stepItem(1), [stepItem]);

  const handleSeek = useCallback(
    (event: Event, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value;
      const clampedTime = currentItem
        ? Math.min(currentItem.endTime, Math.max(currentItem.startTime, time))
        : Math.max(0, time);
      if (!seekMedia?.(clampedTime)) {
        if (videoRef.current) videoRef.current.currentTime = clampedTime;
        if (videoRef2.current && currentVideoSource2)
          videoRef2.current.currentTime = clampedTime;
      }
      lastFreezeTimestampRef.current = null;
      setCurrentTime?.(clampedTime);
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
      setCurrentTime,
      seekMedia,
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
    handlePlayRow,
    clearRowScope: () => { rowScope.current = null; },
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
