import { useEffect } from 'react';
import type React from 'react';
import { formatSource } from '../../../videoPlayer/components/Player/SingleVideo/utils';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

interface UsePlaylistPlaybackEffectsParams
  extends Pick<
    UsePlaylistPlaybackParams,
    | 'isFrozen'
    | 'setIsFrozen'
    | 'currentItem'
    | 'currentAnnotation'
    | 'minFreezeDuration'
    | 'defaultFreezeDuration'
    | 'annotationTimeTolerance'
    | 'freezeRetriggerGuard'
    | 'videoRef'
    | 'videoRef2'
    | 'setCurrentTime'
    | 'setDuration'
    | 'isPlaying'
    | 'currentVideoSource'
    | 'currentVideoSource2'
    | 'viewMode'
    | 'volume'
    | 'isMuted'
  > {
  lastFreezeTimestampRef: React.MutableRefObject<number | null>;
  triggerFreezeFrame: (freezeDuration: number) => void;
  handleItemEnd: () => void;
}

const syncDualViewTimes = (params: {
  viewMode: 'dual' | 'angle1' | 'angle2';
  mainVideo: HTMLVideoElement;
  subVideo: HTMLVideoElement;
}) => {
  if (params.viewMode === 'angle2') {
    params.mainVideo.currentTime = params.subVideo.currentTime;
    return;
  }
  if (params.viewMode === 'angle1') {
    params.subVideo.currentTime = params.mainVideo.currentTime;
    return;
  }
  const timeDiff = Math.abs(params.mainVideo.currentTime - params.subVideo.currentTime);
  if (timeDiff > 0.1) {
    params.subVideo.currentTime = params.mainVideo.currentTime;
  }
};

export const usePlaylistPlaybackEffects = ({
  isFrozen,
  setIsFrozen,
  currentItem,
  currentAnnotation,
  minFreezeDuration,
  defaultFreezeDuration,
  annotationTimeTolerance,
  freezeRetriggerGuard,
  videoRef,
  videoRef2,
  setCurrentTime,
  setDuration,
  isPlaying,
  currentVideoSource,
  currentVideoSource2,
  viewMode,
  volume,
  isMuted,
  lastFreezeTimestampRef,
  triggerFreezeFrame,
  handleItemEnd,
}: UsePlaylistPlaybackEffectsParams): void => {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isFrozen) return;
      const playbackTime = video.currentTime;
      setCurrentTime(playbackTime);

      if (currentItem && currentAnnotation) {
        const effectiveFreezeDuration =
          currentAnnotation.freezeDuration && currentAnnotation.freezeDuration > 0
            ? Math.max(minFreezeDuration, currentAnnotation.freezeDuration)
            : defaultFreezeDuration;
        const shouldFreeze = currentAnnotation.objects.some(
          (obj) => Math.abs(playbackTime - obj.timestamp) < annotationTimeTolerance,
        );
        const lastFreezeAt = lastFreezeTimestampRef.current;
        const recentlyFrozen =
          lastFreezeAt !== null && Math.abs(playbackTime - lastFreezeAt) < freezeRetriggerGuard;
        if (
          currentAnnotation.objects.length > 0 &&
          shouldFreeze &&
          !isFrozen &&
          !recentlyFrozen
        ) {
          lastFreezeTimestampRef.current = playbackTime;
          triggerFreezeFrame(effectiveFreezeDuration);
        }
      }

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

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleItemEnd);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleItemEnd);
    };
  }, [
    annotationTimeTolerance,
    currentAnnotation,
    currentItem,
    defaultFreezeDuration,
    freezeRetriggerGuard,
    handleItemEnd,
    isFrozen,
    lastFreezeTimestampRef,
    minFreezeDuration,
    setCurrentTime,
    setDuration,
    triggerFreezeFrame,
    videoRef,
  ]);

  useEffect(() => {
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo || !currentVideoSource) return;

    if (isPlaying && !isFrozen) {
      if (viewMode !== 'angle2') {
        mainVideo.play().catch(console.error);
      }
      if (subVideo && currentVideoSource2 && viewMode !== 'angle1') {
        subVideo.play().catch(console.error);
      }
      return;
    }

    mainVideo.pause();
    subVideo?.pause();
  }, [currentVideoSource, currentVideoSource2, isFrozen, isPlaying, viewMode, videoRef, videoRef2]);

  useEffect(() => {
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo) return;
    mainVideo.volume = isMuted ? 0 : volume;
    if (subVideo) {
      subVideo.volume = 0;
    }
  }, [isMuted, videoRef, videoRef2, volume]);

  useEffect(() => {
    const mainVideo = videoRef.current;
    if (!mainVideo || !currentVideoSource || !currentItem) return;

    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);
    mainVideo.src = formatSource(currentVideoSource);
    mainVideo.load();
    mainVideo.currentTime = currentItem.startTime;
    setCurrentTime(currentItem.startTime);

    if (isPlaying) {
      mainVideo.play().catch(console.error);
    }
  }, [
    currentItem?.id,
    currentItem,
    currentVideoSource,
    isPlaying,
    lastFreezeTimestampRef,
    setCurrentTime,
    setIsFrozen,
    videoRef,
  ]);

  useEffect(() => {
    const subVideo = videoRef2.current;
    if (!subVideo || !currentVideoSource2 || !currentItem) return;

    subVideo.src = formatSource(currentVideoSource2);
    subVideo.load();
    subVideo.currentTime = currentItem.startTime;
    subVideo.volume = 0;

    if (isPlaying && !isFrozen) {
      subVideo.play().catch(console.error);
    }
  }, [currentItem, currentItem?.id, currentVideoSource2, isFrozen, isPlaying, videoRef2]);

  useEffect(() => {
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo || !subVideo) return;
    if (!currentVideoSource || !currentVideoSource2) return;

    syncDualViewTimes({ viewMode, mainVideo, subVideo });
  }, [currentVideoSource, currentVideoSource2, viewMode, videoRef, videoRef2]);
};
