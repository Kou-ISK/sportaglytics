import { useRef } from 'react';
import { usePlaylistPlaybackActions } from './usePlaylistPlaybackActions';
import { usePlaylistPlaybackEffects } from './usePlaylistPlaybackEffects';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

export const usePlaylistPlayback = (params: UsePlaylistPlaybackParams) => {
  const lastFreezeTimestampRef = useRef<number | null>(null);

  const actions = usePlaylistPlaybackActions({
    items: params.items,
    currentIndex: params.currentIndex,
    setCurrentIndex: params.setCurrentIndex,
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
    setIsDrawingMode: params.setIsDrawingMode,
    minFreezeDuration: params.minFreezeDuration,
    lastFreezeTimestampRef,
  });

  usePlaylistPlaybackEffects({
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
