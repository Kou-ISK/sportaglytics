import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import {
  ANNOTATION_TIME_TOLERANCE,
  DEFAULT_FREEZE_DURATION,
  FREEZE_RETRIGGER_GUARD,
  MIN_FREEZE_DURATION,
} from './playlistWindowController.constants';
import { usePlaylistControlsVisibility } from './usePlaylistControlsVisibility';
import { usePlaylistDrawingModeToggle } from './usePlaylistDrawingModeToggle';
import { usePlaylistDrawingTarget } from './usePlaylistDrawingTarget';
import { usePlaylistHotkeyBindings } from './usePlaylistHotkeyBindings';
import { usePlaylistHotkeys } from './usePlaylistHotkeys';
import { usePlaylistPlayback } from './usePlaylistPlayback';
import { usePlaylistSaveRequest } from './usePlaylistSaveRequest';
import { usePlaylistVideoSizing } from './usePlaylistVideoSizing';
import type { PlaylistWindowDataRuntime } from './usePlaylistWindowDataRuntime';

interface PlaylistWindowInteractionRuntime {
  playback: ReturnType<typeof usePlaylistPlayback>;
  handleToggleDrawingMode: () => void;
}

export const usePlaylistWindowInteractionRuntime = (
  runtime: PlaylistWindowDataRuntime,
): PlaylistWindowInteractionRuntime => {
  const { core, history, selection, exportState, currentItemState } =
    runtime;

  usePlaylistDrawingTarget({
    viewMode: core.viewMode,
    currentVideoSource2: currentItemState.currentVideoSource2,
    setDrawingTarget: core.setDrawingTarget,
  });

  usePlaylistVideoSizing({
    videoRef: core.videoRef,
    videoRef2: core.videoRef2,
    currentVideoSource: currentItemState.currentVideoSource,
    currentVideoSource2: currentItemState.currentVideoSource2,
    viewMode: core.viewMode,
    setPrimaryCanvasSize: core.setPrimaryCanvasSize,
    setPrimarySourceSize: core.setPrimarySourceSize,
    setPrimaryContentRect: core.setPrimaryContentRect,
    setSecondaryCanvasSize: core.setSecondaryCanvasSize,
    setSecondarySourceSize: core.setSecondarySourceSize,
    setSecondaryContentRect: core.setSecondaryContentRect,
  });

  usePlaylistControlsVisibility({
    isVideoAreaHovered: core.isVideoAreaHovered,
    isPlaying: core.isPlaying,
    isDrawingMode: core.isDrawingMode,
    interactionId: core.videoAreaInteractionId,
    setControlsVisible: core.setControlsVisible,
  });

  const playback = usePlaylistPlayback({
    items: history.items,
    currentIndex: core.currentIndex,
    setCurrentIndex: core.setCurrentIndex,
    isPlaying: core.isPlaying,
    setIsPlaying: core.setIsPlaying,
    isFrozen: core.isFrozen,
    setIsFrozen: core.setIsFrozen,
    currentItem: currentItemState.currentItem,
    currentAnnotation: runtime.annotations.currentAnnotation ?? undefined,
    autoAdvance: core.autoAdvance,
    loopPlaylist: core.loopPlaylist,
    viewMode: core.viewMode,
    currentVideoSource: currentItemState.currentVideoSource,
    currentVideoSource2: currentItemState.currentVideoSource2,
    videoRef: core.videoRef,
    videoRef2: core.videoRef2,
    setCurrentTime: core.setCurrentTime,
    setDuration: core.setDuration,
    volume: core.volume,
    isMuted: core.isMuted,
    setVolume: core.setVolume,
    containerRef: core.containerRef,
    isFullscreen: core.isFullscreen,
    setIsFullscreen: core.setIsFullscreen,
    minFreezeDuration: MIN_FREEZE_DURATION,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
    annotationTimeTolerance: ANNOTATION_TIME_TOLERANCE,
    freezeRetriggerGuard: FREEZE_RETRIGGER_GUARD,
  });

  const handleToggleDrawingMode = usePlaylistDrawingModeToggle({
    isDrawingMode: core.isDrawingMode,
    setIsDrawingMode: core.setIsDrawingMode,
    setIsPlaying: core.setIsPlaying,
    persistCanvasObjects: runtime.annotations.persistCanvasObjects,
    annotationCanvasRefPrimary: core.annotationCanvasRefPrimary,
    annotationCanvasRefSecondary: core.annotationCanvasRefSecondary,
  });

  usePlaylistSaveRequest({
    loadedFilePath: core.loadedFilePath,
    handleSavePlaylist: runtime.saveFlow.handleSavePlaylist,
    setCloseAfterSave: core.setCloseAfterSave,
    setSaveDialogOpen: core.setSaveDialogOpen,
  });

  const hotkeyBindings = usePlaylistHotkeyBindings({
    currentTime: core.currentTime,
    handleTogglePlay: playback.handleTogglePlay,
    handleSeek: playback.handleSeek,
    handlePrevious: playback.handlePrevious,
    handleNext: playback.handleNext,
    handleDeleteSelected: selection.deleteSelected,
    handleUndo: runtime.handleUndo,
    handleRedo: runtime.handleRedo,
    handleSavePlaylist: runtime.saveFlow.handleSavePlaylist,
    loadedFilePath: core.loadedFilePath,
    setSaveDialogOpen: core.setSaveDialogOpen,
    setExportDialogOpen: exportState.setExportDialogOpen,
    setViewMode: core.setViewMode,
    setIsPlaying: core.setIsPlaying,
    videoRef: core.videoRef,
    videoRef2: core.videoRef2,
  });
  const playlistHotkeys = usePlaylistHotkeys();

  useGlobalHotkeys(
    playlistHotkeys,
    hotkeyBindings.hotkeyHandlers,
    hotkeyBindings.keyUpHandlers,
  );

  return {
    playback,
    handleToggleDrawingMode,
  };
};
