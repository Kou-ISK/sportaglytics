import {
  buildPlaylistDialogsSection,
  buildPlaylistHeaderSection,
  buildPlaylistItemSection,
  buildPlaylistNowPlayingSection,
  buildPlaylistVideoAreaSection,
} from './playlistWindowControllerSections';
import type { usePlaylistAnnotations } from './usePlaylistAnnotations';
import type { usePlaylistCurrentItem } from './usePlaylistCurrentItem';
import type { usePlaylistDialogHandlers } from './usePlaylistDialogHandlers';
import type { usePlaylistDndSensors } from './usePlaylistDndSensors';
import type { usePlaylistExportState } from './usePlaylistExportState';
import type { usePlaylistHistory } from './usePlaylistHistory';
import type { usePlaylistItemOperations } from './usePlaylistItemOperations';
import type { usePlaylistNotes } from './usePlaylistNotes';
import type { usePlaylistPlayback } from './usePlaylistPlayback';
import type { usePlaylistSaveFlow } from './usePlaylistSaveFlow';
import type { usePlaylistSelection } from './usePlaylistSelection';
import type { usePlaylistVideoControlsState } from './usePlaylistVideoControlsState';
import type { usePlaylistWindowCoreState } from './usePlaylistWindowCoreState';
import type { usePlaylistWindowExportFlow } from './usePlaylistWindowExportFlow';
import type { usePlaylistWindowMenuActions } from './usePlaylistWindowMenuActions';

interface UsePlaylistWindowSectionsParams {
  core: ReturnType<typeof usePlaylistWindowCoreState>;
  history: ReturnType<typeof usePlaylistHistory>;
  selection: ReturnType<typeof usePlaylistSelection>;
  currentItemState: ReturnType<typeof usePlaylistCurrentItem>;
  annotations: ReturnType<typeof usePlaylistAnnotations>;
  videoControls: ReturnType<typeof usePlaylistVideoControlsState>;
  playback: ReturnType<typeof usePlaylistPlayback>;
  notes: ReturnType<typeof usePlaylistNotes>;
  menuActions: ReturnType<typeof usePlaylistWindowMenuActions>;
  exportState: ReturnType<typeof usePlaylistExportState>;
  exportFlow: ReturnType<typeof usePlaylistWindowExportFlow>;
  dialogHandlers: ReturnType<typeof usePlaylistDialogHandlers>;
  saveFlow: ReturnType<typeof usePlaylistSaveFlow>;
  itemOperations: ReturnType<typeof usePlaylistItemOperations>;
  sensors: ReturnType<typeof usePlaylistDndSensors>;
  handleToggleDrawingMode: () => void;
  defaultFreezeDuration: number;
}

export const usePlaylistWindowSections = ({
  core,
  history,
  selection,
  currentItemState,
  annotations,
  videoControls,
  playback,
  notes,
  menuActions,
  exportState,
  exportFlow,
  dialogHandlers,
  saveFlow,
  itemOperations,
  sensors,
  handleToggleDrawingMode,
  defaultFreezeDuration,
}: UsePlaylistWindowSectionsParams) => {
  const header = buildPlaylistHeaderSection({
    playlistName: core.playlistName,
    hasUnsavedChanges: core.hasUnsavedChanges,
    exportInProgress: Boolean(exportFlow.exportProgress),
    hasDualSources: core.videoSources.length >= 2,
    anchorEl: menuActions.anchorEl,
    onMenuOpen: menuActions.handleMenuOpen,
    onMenuClose: menuActions.handleMenuClose,
    onSaveClick: menuActions.handleSaveClick,
    onLoadClick: menuActions.handleLoadPlaylist,
    onViewModeChange: core.setViewMode,
    setSaveDialogOpen: core.setSaveDialogOpen,
    setExportDialogOpen: exportState.setExportDialogOpen,
  });

  const videoArea = buildPlaylistVideoAreaSection({
    currentVideoSource: currentItemState.currentVideoSource,
    currentVideoSource2: currentItemState.currentVideoSource2,
    viewMode: core.viewMode,
    isDrawingMode: core.isDrawingMode,
    drawingTarget: core.drawingTarget,
    onDrawingTargetChange: core.setDrawingTarget,
    annotationCanvasRefPrimary: core.annotationCanvasRefPrimary,
    annotationCanvasRefSecondary: core.annotationCanvasRefSecondary,
    primaryCanvasSize: core.primaryCanvasSize,
    secondaryCanvasSize: core.secondaryCanvasSize,
    primaryContentRect: core.primaryContentRect,
    secondaryContentRect: core.secondaryContentRect,
    currentAnnotation: annotations.currentAnnotation,
    defaultFreezeDuration,
    onObjectsChange: annotations.handleAnnotationObjectsChange,
    onFreezeDurationChange: annotations.handleFreezeDurationChange,
    currentTime: core.currentTime,
    videoRef: core.videoRef,
    videoRef2: core.videoRef2,
    hasItems: history.items.length > 0,
    controlsVisible: core.controlsVisible,
    sliderMin: videoControls.sliderMin,
    sliderMax: videoControls.sliderMax,
    marks: videoControls.marks,
    isPlaying: core.isPlaying,
    isFrozen: core.isFrozen,
    autoAdvance: core.autoAdvance,
    loopPlaylist: core.loopPlaylist,
    isMuted: core.isMuted,
    volume: core.volume,
    isFullscreen: core.isFullscreen,
    onSeek: playback.handleSeek,
    onSeekCommitted: videoControls.handleSeekCommitted,
    onPrevious: playback.handlePrevious,
    onTogglePlay: playback.handleTogglePlay,
    onNext: playback.handleNext,
    onToggleAutoAdvance: videoControls.handleToggleAutoAdvance,
    onToggleLoop: videoControls.handleToggleLoop,
    onToggleDrawingMode: handleToggleDrawingMode,
    onToggleMute: videoControls.handleToggleMute,
    onVolumeChange: playback.handleVolumeChange,
    onToggleFullscreen: playback.handleToggleFullscreen,
    onVideoAreaHoverChange: core.setIsVideoAreaHovered,
    onVideoAreaInteraction: () =>
      core.setVideoAreaInteractionId((previous) => previous + 1),
  });

  const itemSection = buildPlaylistItemSection({
    items: history.items,
    currentIndex: core.currentIndex,
    selectedItemIds: selection.selectedItemIds,
    sensors,
    onDragEnd: itemOperations.handleDragEnd,
    onRemove: itemOperations.handleRemoveItem,
    onPlay: playback.handlePlayItem,
    onEditNote: notes.handleEditNote,
    onToggleSelect: selection.toggleSelect,
  });

  const nowPlaying = buildPlaylistNowPlayingSection({
    currentItem: currentItemState.currentItem,
    isFrozen: core.isFrozen,
    currentIndex: core.currentIndex,
    totalCount: history.items.length,
    currentAnnotation: annotations.currentAnnotation,
  });

  const dialogs = buildPlaylistDialogsSection({
    saveDialogOpen: core.saveDialogOpen,
    onCloseSaveDialog: dialogHandlers.handleCloseSaveDialog,
    onSavePlaylistAs: saveFlow.handleSavePlaylistAs,
    playlistName: core.playlistName,
    playlistType: core.playlistType,
    closeAfterSave: core.closeAfterSave,
    exportDialogOpen: exportState.exportDialogOpen,
    onCloseExportDialog: dialogHandlers.handleCloseExportDialog,
    onExportPlaylist: exportFlow.handleExportPlaylist,
    exportFileName: exportState.exportFileName,
    setExportFileName: exportState.setExportFileName,
    exportScope: exportState.exportScope,
    setExportScope: exportState.setExportScope,
    selectedCount: selection.selectedCount,
    exportMode: exportState.exportMode,
    setExportMode: exportState.setExportMode,
    angleOption: exportState.angleOption,
    setAngleOption: exportState.setAngleOption,
    videoSources: core.videoSources,
    selectedAngleIndex: exportState.selectedAngleIndex,
    setSelectedAngleIndex: exportState.setSelectedAngleIndex,
    overlaySettings: exportState.overlaySettings,
    setOverlaySettings: exportState.setOverlaySettings,
    exportInProgress: Boolean(exportFlow.exportProgress),
    noteDialogOpen: notes.noteDialogOpen,
    onCloseNoteDialog: dialogHandlers.handleCloseNoteDialog,
    onSaveNote: notes.handleSaveNote,
    initialNote: currentItemState.editingItem?.memo || '',
    itemName: currentItemState.editingItem?.actionName || '',
    saveProgress: core.saveProgress,
  });

  return {
    header,
    videoArea,
    itemSection,
    nowPlaying,
    dialogs,
  };
};
