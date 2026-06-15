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
  const currentItemId = currentItem?.id;
  const currentItemStartTime = currentItem?.startTime;
  const currentItemEndTime = currentItem?.endTime;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isFrozen) return;
      const playbackTime = video.currentTime;
      setCurrentTime(playbackTime);

      if (currentItemId && currentAnnotation) {
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

      if (currentItemEndTime !== undefined && video.currentTime >= currentItemEndTime) {
        handleItemEnd();
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (currentItemStartTime !== undefined) {
        video.currentTime = currentItemStartTime;
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
    currentItemEndTime,
    currentItemId,
    currentItemStartTime,
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
    if (!mainVideo || !currentVideoSource || currentItemStartTime === undefined) {
      return;
    }

    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);
    mainVideo.src = formatSource(currentVideoSource);
    mainVideo.load();
    mainVideo.currentTime = currentItemStartTime;
    setCurrentTime(currentItemStartTime);

    if (isPlaying) {
      mainVideo.play().catch(console.error);
    }
  }, [
    currentItemId,
    currentItemStartTime,
    currentVideoSource,
    isPlaying,
    lastFreezeTimestampRef,
    setCurrentTime,
    setIsFrozen,
    videoRef,
  ]);

  useEffect(() => {
    const subVideo = videoRef2.current;
    if (!subVideo || !currentVideoSource2 || currentItemStartTime === undefined) {
      return;
    }

    subVideo.src = formatSource(currentVideoSource2);
    subVideo.load();
    subVideo.currentTime = currentItemStartTime;
    subVideo.volume = 0;

    if (isPlaying && !isFrozen) {
      subVideo.play().catch(console.error);
    }
  }, [
    currentItemId,
    currentItemStartTime,
    currentVideoSource2,
    isFrozen,
    isPlaying,
    videoRef2,
  ]);

  useEffect(() => {
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo || !subVideo) return;
    if (!currentVideoSource || !currentVideoSource2) return;

    syncDualViewTimes({ viewMode, mainVideo, subVideo });
  }, [currentVideoSource, currentVideoSource2, viewMode, videoRef, videoRef2]);
};
