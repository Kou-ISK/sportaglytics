import { usePlaylistMediaTimeline } from '../../media/usePlaylistMediaTimeline';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePlaylistPlaybackActions } from './usePlaylistPlaybackActions';
import { usePlaylistPlaybackEffects } from './usePlaylistPlaybackEffects';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

export const usePlaylistPlayback = (params: UsePlaylistPlaybackParams) => {
  const lastFreezeTimestampRef = useRef<number | null>(null);
  const freezeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
    },
    [],
  );

  const timelineCallbacks = useRef({
    onTime: (_time: number): void => undefined,
    onEnd: (): void => undefined,
  });
  const mediaTimeline = usePlaylistMediaTimeline(params, timelineCallbacks);
  const actions = usePlaylistPlaybackActions({
    seekMedia: mediaTimeline.seek,
    items: params.items,
    currentItem: params.currentItem,
    currentIndex: params.currentIndex,
    setCurrentIndex: params.setCurrentIndex,
    setCurrentTime: params.setCurrentTime,
    isPlaying: params.isPlaying,
    setIsPlaying: params.setIsPlaying,
    isFrozen: params.isFrozen,
    setIsFrozen: params.setIsFrozen,
    autoAdvance: params.autoAdvance,
    loopPlaylist: params.loopPlaylist,
    currentVideoSource2: params.currentVideoSource2,
    videoRef: params.videoRef,
    videoRef2: params.videoRef2,
    setVolume: params.setVolume,
    containerRef: params.containerRef,
    isFullscreen: params.isFullscreen,
    setIsFullscreen: params.setIsFullscreen,
    minFreezeDuration: params.minFreezeDuration,
    lastFreezeTimestampRef,
    freezeTimeoutRef,
  });

  useLayoutEffect(() => {
    timelineCallbacks.current = {
      onEnd: actions.handleItemEnd,
      onTime: (time) => {
        params.setCurrentTime(time);
        const annotation = params.currentAnnotation;
        if (!annotation || params.isFrozen || !params.isPlaying) return;
        const recent = lastFreezeTimestampRef.current;
        if (
          recent !== null &&
          Math.abs(time - recent) < params.freezeRetriggerGuard
        )
          return;
        if (
          annotation.objects.some(
            (object) =>
              !object.motion &&
              Math.abs(time - object.timestamp) <
                params.annotationTimeTolerance,
          )
        ) {
          lastFreezeTimestampRef.current = time;
          actions.triggerFreezeFrame(
            Math.max(
              params.minFreezeDuration,
              annotation.freezeDuration || params.defaultFreezeDuration,
            ),
          );
        }
      },
    };
  }, [actions.handleItemEnd, actions.triggerFreezeFrame, params]);

  usePlaylistPlaybackEffects({
    disabled: mediaTimeline.active,
    isFrozen: params.isFrozen,
    setIsFrozen: params.setIsFrozen,
    currentItem: params.currentItem,
    currentAnnotation: params.currentAnnotation,
    minFreezeDuration: params.minFreezeDuration,
    defaultFreezeDuration: params.defaultFreezeDuration,
    annotationTimeTolerance: params.annotationTimeTolerance,
    freezeRetriggerGuard: params.freezeRetriggerGuard,
    videoRef: params.videoRef,
    videoRef2: params.videoRef2,
    setCurrentTime: params.setCurrentTime,
    setDuration: params.setDuration,
    isPlaying: params.isPlaying,
    currentVideoSource: params.currentVideoSource,
    currentVideoSource2: params.currentVideoSource2,
    viewMode: params.viewMode,
    volume: params.volume,
    isMuted: params.isMuted,
    lastFreezeTimestampRef,
    triggerFreezeFrame: actions.triggerFreezeFrame,
    handleItemEnd: actions.handleItemEnd,
  });

  return {
    mediaTimeline,
    handlePlayItem: actions.handlePlayItem,
    handleTogglePlay: actions.handleTogglePlay,
    handlePrevious: actions.handlePrevious,
    handleNext: actions.handleNext,
    handleSeek: actions.handleSeek,
    handleVolumeChange: actions.handleVolumeChange,
    handleToggleFullscreen: actions.handleToggleFullscreen,
    triggerFreezeFrame: actions.triggerFreezeFrame,
  };
};
