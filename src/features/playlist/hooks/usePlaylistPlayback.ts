import { useCallback, useEffect, useRef } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
} from '../../../types/Playlist';

interface UsePlaylistPlaybackParams {
  items: PlaylistItem[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isFrozen: boolean;
  setIsFrozen: React.Dispatch<React.SetStateAction<boolean>>;
  currentItem: PlaylistItem | null;
  currentAnnotation?: ItemAnnotation;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  viewMode: 'dual' | 'angle1' | 'angle2';
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoRef2: React.RefObject<HTMLVideoElement>;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  volume: number;
  isMuted: boolean;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  containerRef: React.RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawingMode: React.Dispatch<React.SetStateAction<boolean>>;
  minFreezeDuration: number;
  defaultFreezeDuration: number;
  annotationTimeTolerance: number;
  freezeRetriggerGuard: number;
}

export const usePlaylistPlayback = ({
  items,
  currentIndex,
  setCurrentIndex,
  isPlaying,
  setIsPlaying,
  isFrozen,
  setIsFrozen,
  currentItem,
  currentAnnotation,
  autoAdvance,
  loopPlaylist,
  viewMode,
  currentVideoSource,
  currentVideoSource2,
  videoRef,
  videoRef2,
  setCurrentTime,
  setDuration,
  volume,
  isMuted,
  setVolume,
  containerRef,
  isFullscreen,
  setIsFullscreen,
  setIsDrawingMode,
  minFreezeDuration,
  defaultFreezeDuration,
  annotationTimeTolerance,
  freezeRetriggerGuard,
}: UsePlaylistPlaybackParams) => {
  const lastFreezeTimestampRef = useRef<number | null>(null);

  const triggerFreezeFrame = useCallback(
    (freezeDuration: number) => {
      const duration = Math.max(minFreezeDuration, freezeDuration);
      if (isFrozen || duration <= 0) return;

      const video = videoRef.current;
      const video2 = videoRef2.current;

      if (video) {
        video.pause();
      }
      if (video2) {
        video2.pause();
      }

      setIsFrozen(true);
      setIsPlaying(false);
    },
    [isFrozen, minFreezeDuration, setIsFrozen, setIsPlaying, videoRef, videoRef2],
  );

  const handleItemEnd = useCallback(() => {
    // Clear any freeze state
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
    loopPlaylist,
    setCurrentIndex,
    setIsFrozen,
    setIsPlaying,
  ]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isFrozen) return;
      const playbackTime = video.currentTime;
      setCurrentTime(playbackTime);

      // Check for freeze frame trigger (annotation timestamp)
      if (currentItem && currentAnnotation) {
        const referenceTime = playbackTime;
        const effectiveFreezeDuration =
          currentAnnotation.freezeDuration &&
          currentAnnotation.freezeDuration > 0
            ? Math.max(minFreezeDuration, currentAnnotation.freezeDuration)
            : defaultFreezeDuration;
        // アノテーションのtimestampに到達したらフリーズ
        const shouldFreeze = currentAnnotation.objects.some(
          (obj) =>
            Math.abs(referenceTime - obj.timestamp) < annotationTimeTolerance,
        );
        const lastFreezeAt = lastFreezeTimestampRef.current;
        const recentlyFrozen =
          lastFreezeAt !== null &&
          Math.abs(referenceTime - lastFreezeAt) < freezeRetriggerGuard;
        if (
          currentAnnotation.objects.length > 0 &&
          shouldFreeze &&
          !isFrozen &&
          !recentlyFrozen
        ) {
          lastFreezeTimestampRef.current = referenceTime;
          triggerFreezeFrame(effectiveFreezeDuration);
        }
      }

      // Check for item end
      if (currentItem && video.currentTime >= currentItem.endTime) {
        handleItemEnd();
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (currentItem) {
        video.currentTime = currentItem.startTime;
      }
    };

    const handleEnded = () => {
      handleItemEnd();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [
    annotationTimeTolerance,
    currentAnnotation,
    currentItem,
    defaultFreezeDuration,
    freezeRetriggerGuard,
    handleItemEnd,
    isFrozen,
    minFreezeDuration,
    setCurrentTime,
    setDuration,
    triggerFreezeFrame,
    videoRef,
  ]);

  // Play/pause handling for both videos
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video || !currentVideoSource) return;

    if (isPlaying && !isFrozen) {
      // viewModeに応じてvideoを再生
      if (viewMode !== 'angle2') {
        video.play().catch(console.error);
      }
      // viewModeに応じてvideo2を再生
      if (video2 && currentVideoSource2 && viewMode !== 'angle1') {
        video2.play().catch(console.error);
      }
    } else {
      video.pause();
      if (video2) {
        video2.pause();
      }
    }
  }, [isPlaying, isFrozen, currentVideoSource, currentVideoSource2, viewMode, videoRef, videoRef2]);

  // Volume handling
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    if (video2) {
      video2.volume = 0;
    }
  }, [volume, isMuted, videoRef, videoRef2]);

  // Set video source when item changes (primary)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoSource || !currentItem) return;

    // Reset freeze state
    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);

    video.src = currentVideoSource;
    video.load();
    video.currentTime = currentItem.startTime;
    setCurrentTime(currentItem.startTime); // 即座にステートも更新

    if (isPlaying) {
      video.play().catch(console.error);
    }
  }, [currentVideoSource, currentItem?.id]);

  // Set video source when item changes (secondary)
  useEffect(() => {
    const video2 = videoRef2.current;
    if (!video2 || !currentVideoSource2 || !currentItem) return;

    video2.src = currentVideoSource2;
    video2.load();
    video2.currentTime = currentItem.startTime;
    video2.volume = 0;

    if (isPlaying && !isFrozen) {
      video2.play().catch(console.error);
    }
  }, [currentVideoSource2, currentItem?.id]);

  // viewMode切り替え時に再生位置を同期
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video || !video2) return;
    if (!currentVideoSource || !currentVideoSource2) return;

    if (viewMode === 'angle2') {
      // angle2表示中: videoのcurrentTimeをvideo2に合わせる
      video.currentTime = video2.currentTime;
    } else if (viewMode === 'angle1') {
      // angle1表示中: video2のcurrentTimeをvideoに合わせる
      video2.currentTime = video.currentTime;
    } else if (viewMode === 'dual') {
      // dual表示中: 再生位置がズレている場合は同期
      const timeDiff = Math.abs(video.currentTime - video2.currentTime);
      if (timeDiff > 0.1) {
        video2.currentTime = video.currentTime;
      }
    }
  }, [viewMode, currentVideoSource, currentVideoSource2, videoRef, videoRef2]);

  const handlePlayItem = useCallback(
    (id?: string) => {
      if (id) {
        const index = items.findIndex((item) => item.id === id);
        if (index !== -1) {
          setCurrentIndex(index);
          setIsPlaying(true);
          setIsDrawingMode(false); // Exit drawing mode when changing item
        }
      } else if (currentIndex >= 0) {
        setIsPlaying(true);
      } else if (items.length > 0) {
        setCurrentIndex(0);
        setIsPlaying(true);
      }
    },
    [items, currentIndex, setCurrentIndex, setIsPlaying, setIsDrawingMode],
  );

  const handleTogglePlay = useCallback(() => {
    if (isFrozen) {
      // Skip freeze and continue
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
  }, [currentIndex, items.length, isPlaying, isFrozen, setCurrentIndex, setIsFrozen, setIsPlaying]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(items.length - 1);
      setIsPlaying(true);
    }
  }, [currentIndex, loopPlaylist, items.length, setCurrentIndex, setIsPlaying]);

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
      // videoSource2が存在する場合は常に同期（表示されていなくても）
      if (videoRef2.current && currentVideoSource2) {
        videoRef2.current.currentTime = time;
      }
      lastFreezeTimestampRef.current = null;
      setIsFrozen(false);

      // フォーカスを外してホットキーを有効にする
      if (event.target && 'blur' in event.target) {
        (event.target as HTMLElement).blur();
      }
      // 確実にフォーカスを外す
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [currentVideoSource2, setIsFrozen, videoRef, videoRef2],
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
  };
};
