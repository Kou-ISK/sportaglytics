import { useEffect, useRef } from 'react';
import type React from 'react';
import { formatSource } from '../../../videoPlayer/components/Player/SingleVideo/utils';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

interface UsePlaylistPlaybackEffectsParams extends Pick<
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
  disabled?: boolean;
  lastFreezeTimestampRef: React.MutableRefObject<number | null>;
  triggerFreezeFrame: (freezeDuration: number) => void;
  handleItemEnd: () => void;
}

export const usePlaylistPlaybackEffects = ({
  disabled = false,
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
  const isPlayingRef = useRef(isPlaying);
  const isFrozenRef = useRef(isFrozen);
  const previousViewMode = useRef(viewMode);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const endedItemIdRef = useRef<string | null>(null);
  const currentItemId = currentItem?.id;
  const currentItemStartTime = currentItem?.startTime;
  const currentItemEndTime = currentItem?.endTime;

  useEffect(() => {
    if (disabled) return;
    isPlayingRef.current = isPlaying;
    isFrozenRef.current = isFrozen;
  }, [disabled, isFrozen, isPlaying]);

  useEffect(() => {
    if (disabled) return;
    endedItemIdRef.current = null;
  }, [disabled, currentItemId]);

  useEffect(() => {
    if (disabled) return;
    const video = viewMode === 'angle2' ? videoRef2.current : videoRef.current;
    if (!video) return;

    const finishCurrentItem = (): void => {
      if (endedItemIdRef.current === currentItemId) return;
      endedItemIdRef.current = currentItemId ?? null;
      handleItemEnd();
    };

    const handleTimeUpdate = () => {
      if (isFrozenRef.current) return;
      const playbackTime = video.currentTime;
      setCurrentTime(playbackTime);

      if (isPlayingRef.current && currentItemId && currentAnnotation) {
        const effectiveFreezeDuration =
          currentAnnotation.freezeDuration &&
          currentAnnotation.freezeDuration > 0
            ? Math.max(minFreezeDuration, currentAnnotation.freezeDuration)
            : defaultFreezeDuration;
        const shouldFreeze = currentAnnotation.objects.some(
          (obj) =>
            !obj.motion &&
            Math.abs(playbackTime - obj.timestamp) < annotationTimeTolerance,
        );
        const lastFreezeAt = lastFreezeTimestampRef.current;
        const recentlyFrozen =
          lastFreezeAt !== null &&
          Math.abs(playbackTime - lastFreezeAt) < freezeRetriggerGuard;
        if (
          currentAnnotation.objects.length > 0 &&
          shouldFreeze &&
          !isFrozenRef.current &&
          !recentlyFrozen
        ) {
          lastFreezeTimestampRef.current = playbackTime;
          triggerFreezeFrame(effectiveFreezeDuration);
        }
      }

      if (
        isPlayingRef.current &&
        currentItemEndTime !== undefined &&
        video.currentTime >= currentItemEndTime
      ) {
        finishCurrentItem();
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
    video.addEventListener('ended', finishCurrentItem);

    let animationFrameId = 0;
    const updateFrame = (): void => {
      handleTimeUpdate();
      animationFrameId = requestAnimationFrame(updateFrame);
    };
    if (isPlaying) animationFrameId = requestAnimationFrame(updateFrame);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', finishCurrentItem);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [
    disabled,
    annotationTimeTolerance,
    currentAnnotation,
    currentItemEndTime,
    currentItemId,
    currentItemStartTime,
    defaultFreezeDuration,
    freezeRetriggerGuard,
    handleItemEnd,
    isPlaying,
    lastFreezeTimestampRef,
    minFreezeDuration,
    setCurrentTime,
    setDuration,
    triggerFreezeFrame,
    videoRef,
    videoRef2,
    viewMode,
  ]);

  useEffect(() => {
    if (disabled) return;
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo) return;

    if (isPlaying && !isFrozen) {
      if (viewMode !== 'angle2' && currentVideoSource) {
        mainVideo.play().catch(console.error);
      } else mainVideo.pause();
      if (subVideo && currentVideoSource2 && viewMode !== 'angle1') {
        subVideo.play().catch(console.error);
      } else subVideo?.pause();
      return;
    }

    mainVideo.pause();
    subVideo?.pause();
  }, [
    disabled,
    currentVideoSource,
    currentVideoSource2,
    isFrozen,
    isPlaying,
    viewMode,
    videoRef,
    videoRef2,
  ]);

  useEffect(() => {
    if (disabled) return;
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo) return;
    mainVideo.volume = isMuted || viewMode === 'angle2' ? 0 : volume;
    if (subVideo) {
      subVideo.volume = !isMuted && viewMode === 'angle2' ? volume : 0;
    }
  }, [disabled, isMuted, videoRef, videoRef2, volume, viewMode]);

  useEffect(() => {
    if (disabled) return;
    const mainVideo = videoRef.current;
    if (
      !mainVideo ||
      !currentVideoSource ||
      currentItemStartTime === undefined
    ) {
      return;
    }

    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);
    mainVideo.src = formatSource(currentVideoSource);
    mainVideo.load();
    mainVideo.currentTime = currentItemStartTime;
    setCurrentTime(currentItemStartTime);

    const playWhenReady = (): void => {
      if (
        isPlayingRef.current &&
        !isFrozenRef.current &&
        viewModeRef.current !== 'angle2'
      ) {
        mainVideo.play().catch(console.error);
      }
    };
    mainVideo.addEventListener('canplay', playWhenReady, { once: true });
    return () => mainVideo.removeEventListener('canplay', playWhenReady);
  }, [
    disabled,
    currentItemId,
    currentItemStartTime,
    currentVideoSource,
    lastFreezeTimestampRef,
    setCurrentTime,
    setIsFrozen,
    videoRef,
  ]);

  useEffect(() => {
    if (disabled) return;
    const subVideo = videoRef2.current;
    if (
      !subVideo ||
      !currentVideoSource2 ||
      currentItemStartTime === undefined
    ) {
      return;
    }

    subVideo.src = formatSource(currentVideoSource2);
    subVideo.load();
    subVideo.currentTime = currentItemStartTime;

    const playWhenReady = (): void => {
      if (
        isPlayingRef.current &&
        !isFrozenRef.current &&
        viewModeRef.current !== 'angle1'
      ) {
        subVideo.play().catch(console.error);
      }
    };
    subVideo.addEventListener('canplay', playWhenReady, { once: true });
    return () => subVideo.removeEventListener('canplay', playWhenReady);
  }, [
    disabled,
    currentItemId,
    currentItemStartTime,
    currentVideoSource2,
    videoRef2,
  ]);

  useEffect(() => {
    if (disabled) return;
    const mainVideo = videoRef.current;
    const subVideo = videoRef2.current;
    if (!mainVideo || !subVideo) return;
    if (!currentVideoSource || !currentVideoSource2) return;

    // Carry the visible angle's clock across a temporary angle switch.
    const previous = previousViewMode.current;
    previousViewMode.current = viewMode;
    const time =
      previous === 'angle2' ? subVideo.currentTime : mainVideo.currentTime;
    mainVideo.currentTime = time;
    subVideo.currentTime = time;
  }, [
    disabled,
    currentVideoSource,
    currentVideoSource2,
    viewMode,
    videoRef,
    videoRef2,
  ]);
};
