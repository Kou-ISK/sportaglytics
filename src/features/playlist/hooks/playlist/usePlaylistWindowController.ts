import { useCallback } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import { renderAnnotationPng } from '../../utils/renderAnnotationPng';
import { usePlaylistAnnotations } from './usePlaylistAnnotations';
import { usePlaylistControlsVisibility } from './usePlaylistControlsVisibility';
import { usePlaylistCurrentItem } from './usePlaylistCurrentItem';
import { usePlaylistDialogHandlers } from './usePlaylistDialogHandlers';
import { usePlaylistDrawingTarget } from './usePlaylistDrawingTarget';
import { usePlaylistExportState } from './usePlaylistExportState';
import { usePlaylistHistory } from './usePlaylistHistory';
import { usePlaylistHistorySync } from './usePlaylistHistorySync';
import { usePlaylistHotkeyBindings } from './usePlaylistHotkeyBindings';
import { usePlaylistHotkeys } from './usePlaylistHotkeys';
import { usePlaylistIpcSync } from './usePlaylistIpcSync';
import { usePlaylistItemOperations } from './usePlaylistItemOperations';
import { usePlaylistLoader } from './usePlaylistLoader';
import { usePlaylistNotes } from './usePlaylistNotes';
import { usePlaylistPlayback } from './usePlaylistPlayback';
import { usePlaylistSaveFlow } from './usePlaylistSaveFlow';
import { usePlaylistSaveRequest } from './usePlaylistSaveRequest';
import { usePlaylistSelection } from './usePlaylistSelection';
import { usePlaylistVideoControlsState } from './usePlaylistVideoControlsState';
import { usePlaylistVideoSizing } from './usePlaylistVideoSizing';
import { usePlaylistVideoSourcesSync } from './usePlaylistVideoSourcesSync';
import { usePlaylistWindowCoreState } from './usePlaylistWindowCoreState';
import { usePlaylistWindowExportFlow } from './usePlaylistWindowExportFlow';
import { usePlaylistWindowMenuActions } from './usePlaylistWindowMenuActions';
import { usePlaylistWindowSync } from './usePlaylistWindowSync';

const DEFAULT_FREEZE_DURATION = 3;
const MIN_FREEZE_DURATION = 1;
const ANNOTATION_TIME_TOLERANCE = 0.12;
const FREEZE_RETRIGGER_GUARD = 0.3;

export const usePlaylistWindowController = () => {
  const { success, error: showError } = useNotification();
  const core = usePlaylistWindowCoreState();

  const history = usePlaylistHistory([]);

  const selection = usePlaylistSelection({
    items: history.items,
    setItems: history.setItems,
    onDirtyChange: core.setHasUnsavedChanges,
  });

  const exportState = usePlaylistExportState();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const notes = usePlaylistNotes({
    setItemsWithHistory: history.setItems,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
  });

  const currentItemState = usePlaylistCurrentItem({
    items: history.items,
    currentIndex: core.currentIndex,
    videoSources: core.videoSources,
    duration: core.duration,
    editingItemId: notes.editingItemId,
  });

  const annotations = usePlaylistAnnotations({
    currentItem: currentItemState.currentItem,
    itemAnnotations: core.itemAnnotations,
    setItemAnnotations: core.setItemAnnotations,
    setItemsWithHistory: history.setItems,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
    minFreezeDuration: MIN_FREEZE_DURATION,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
  });

  usePlaylistVideoSourcesSync({
    currentItem: currentItemState.currentItem,
    videoSources: core.videoSources,
    setVideoSources: core.setVideoSources,
  });

  const videoControls = usePlaylistVideoControlsState({
    currentItem: currentItemState.currentItem,
    currentAnnotation: annotations.currentAnnotation,
    duration: core.duration,
    autoAdvance: core.autoAdvance,
    loopPlaylist: core.loopPlaylist,
    isMuted: core.isMuted,
    setAutoAdvance: core.setAutoAdvance,
    setLoopPlaylist: core.setLoopPlaylist,
    setIsMuted: core.setIsMuted,
  });

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

  const itemOperations = usePlaylistItemOperations({
    currentIndex: core.currentIndex,
    setCurrentIndex: core.setCurrentIndex,
    setIsPlaying: core.setIsPlaying,
    setItemsWithHistory: history.setItems,
    setItemAnnotations: core.setItemAnnotations,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
  });

  usePlaylistIpcSync({
    setItemsWithHistory: history.setItems,
    setPlaylistName: core.setPlaylistName,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
    setItemAnnotations: core.setItemAnnotations,
    setPlaylistType: core.setPlaylistType,
    setPackagePath: core.setPackagePath,
    setVideoSources: core.setVideoSources,
    setViewMode: core.setViewMode,
    setSaveProgress: core.setSaveProgress,
    setIsDirty: core.setIsDirty,
  });

  usePlaylistWindowSync({
    playlistName: core.playlistName,
    loadedFilePath: core.loadedFilePath,
    isDirty: core.isDirty,
  });

  const loader = usePlaylistLoader({
    setItemsWithHistory: history.setItems,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
    setPlaylistName: core.setPlaylistName,
    setPlaylistType: core.setPlaylistType,
    setPackagePath: core.setPackagePath,
    setLoadedFilePath: core.setLoadedFilePath,
    setIsDirty: core.setIsDirty,
    setItemAnnotations: core.setItemAnnotations,
    setVideoSources: core.setVideoSources,
    setViewMode: core.setViewMode,
    setCurrentIndex: core.setCurrentIndex,
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
    currentAnnotation: annotations.currentAnnotation ?? undefined,
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
    setIsDrawingMode: core.setIsDrawingMode,
    minFreezeDuration: MIN_FREEZE_DURATION,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
    annotationTimeTolerance: ANNOTATION_TIME_TOLERANCE,
    freezeRetriggerGuard: FREEZE_RETRIGGER_GUARD,
  });

  const handleToggleDrawingMode = useCallback(() => {
    if (core.isDrawingMode) {
      annotations.persistCanvasObjects(core.annotationCanvasRefPrimary, 'primary');
      annotations.persistCanvasObjects(core.annotationCanvasRefSecondary, 'secondary');
    }
    core.setIsDrawingMode(!core.isDrawingMode);
    if (!core.isDrawingMode) {
      core.setIsPlaying(false);
    }
  }, [annotations, core]);

  const playlistHotkeys = usePlaylistHotkeys();

  const { handleUndo, handleRedo } = usePlaylistHistorySync({
    undo: history.undo,
    redo: history.redo,
    setItemAnnotations: core.setItemAnnotations,
  });

  const saveFlow = usePlaylistSaveFlow({
    items: history.items,
    videoSources: core.videoSources,
    packagePath: core.packagePath,
    itemAnnotations: core.itemAnnotations,
    playlistName: core.playlistName,
    playlistType: core.playlistType,
    setPlaylistName: core.setPlaylistName,
    setPlaylistType: core.setPlaylistType,
    setLoadedFilePath: core.setLoadedFilePath,
    setIsDirty: core.setIsDirty,
    setHasUnsavedChanges: core.setHasUnsavedChanges,
    setSaveDialogOpen: core.setSaveDialogOpen,
    setSaveProgress: core.setSaveProgress,
  });

  usePlaylistSaveRequest({
    loadedFilePath: core.loadedFilePath,
    handleSavePlaylist: saveFlow.handleSavePlaylist,
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
    handleUndo,
    handleRedo,
    handleSavePlaylist: saveFlow.handleSavePlaylist,
    loadedFilePath: core.loadedFilePath,
    setSaveDialogOpen: core.setSaveDialogOpen,
    setExportDialogOpen: exportState.setExportDialogOpen,
    setViewMode: core.setViewMode,
    setIsPlaying: core.setIsPlaying,
    videoRef: core.videoRef,
    videoRef2: core.videoRef2,
  });

  useGlobalHotkeys(
    playlistHotkeys,
    hotkeyBindings.hotkeyHandlers,
    hotkeyBindings.keyUpHandlers,
  );

  const menuActions = usePlaylistWindowMenuActions({
    loadPlaylistFromPath: loader.loadPlaylistFromPath,
    loadedFilePath: core.loadedFilePath,
    handleSavePlaylist: saveFlow.handleSavePlaylist,
    setSaveDialogOpen: core.setSaveDialogOpen,
  });

  const exportFlow = usePlaylistWindowExportFlow({
    items: history.items,
    selectedItems: selection.selectedItems,
    videoSources: core.videoSources,
    exportScope: exportState.exportScope,
    angleOption: exportState.angleOption,
    selectedAngleIndex: exportState.selectedAngleIndex,
    exportMode: exportState.exportMode,
    exportFileName: exportState.exportFileName,
    overlaySettings: exportState.overlaySettings,
    itemAnnotations: core.itemAnnotations,
    minFreezeDuration: MIN_FREEZE_DURATION,
    primaryContentRect: core.primaryContentRect,
    secondaryContentRect: core.secondaryContentRect,
    primarySourceSize: core.primarySourceSize,
    secondarySourceSize: core.secondarySourceSize,
    renderAnnotationPng,
    onMissingApi: showError,
    onSuccess: success,
    onError: showError,
    setExportDialogOpen: exportState.setExportDialogOpen,
  });

  const dialogHandlers = usePlaylistDialogHandlers({
    setSaveDialogOpen: core.setSaveDialogOpen,
    setCloseAfterSave: core.setCloseAfterSave,
    setExportDialogOpen: exportState.setExportDialogOpen,
    setNoteDialogOpen: notes.setNoteDialogOpen,
    setEditingItemId: notes.setEditingItemId,
    onCloseExportProgress: exportFlow.clearExportProgress,
  });

  return {
    containerRef: core.containerRef,
    header: {
      playlistName: core.playlistName,
      hasUnsavedChanges: core.hasUnsavedChanges,
      exportDisabled: Boolean(exportFlow.exportProgress),
      hasDualSources: core.videoSources.length >= 2,
      anchorEl: menuActions.anchorEl,
      onMenuOpen: menuActions.handleMenuOpen,
      onMenuClose: menuActions.handleMenuClose,
      onSaveClick: menuActions.handleSaveClick,
      onSaveAsClick: () => core.setSaveDialogOpen(true),
      onLoadClick: menuActions.handleLoadPlaylist,
      onExportClick: () => exportState.setExportDialogOpen(true),
      onViewModeChange: core.setViewMode,
    },
    videoArea: {
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
      defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
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
      showControls: Boolean(currentItemState.currentItem),
    },
    itemSection: {
      items: history.items,
      currentIndex: core.currentIndex,
      selectedItemIds: selection.selectedItemIds,
      sensors,
      onDragEnd: itemOperations.handleDragEnd,
      onRemove: itemOperations.handleRemoveItem,
      onPlay: playback.handlePlayItem,
      onEditNote: notes.handleEditNote,
      onToggleSelect: selection.toggleSelect,
    },
    nowPlaying: currentItemState.currentItem
      ? {
          currentItem: currentItemState.currentItem,
          isFrozen: core.isFrozen,
          currentIndex: core.currentIndex,
          totalCount: history.items.length,
          annotation: annotations.currentAnnotation ?? undefined,
        }
      : null,
    dialogs: {
      saveDialog: {
        open: core.saveDialogOpen,
        onClose: dialogHandlers.handleCloseSaveDialog,
        onSave: saveFlow.handleSavePlaylistAs,
        defaultName: core.playlistName,
        defaultType: core.playlistType,
        closeAfterSave: core.closeAfterSave,
      },
      exportDialog: {
        open: exportState.exportDialogOpen,
        onClose: dialogHandlers.handleCloseExportDialog,
        onExport: exportFlow.handleExportPlaylist,
        exportFileName: exportState.exportFileName,
        setExportFileName: exportState.setExportFileName,
        exportScope: exportState.exportScope,
        setExportScope: exportState.setExportScope,
        selectedItemCount: selection.selectedCount,
        exportMode: exportState.exportMode,
        setExportMode: exportState.setExportMode,
        angleOption: exportState.angleOption,
        setAngleOption: exportState.setAngleOption,
        videoSources: core.videoSources,
        selectedAngleIndex: exportState.selectedAngleIndex,
        setSelectedAngleIndex: exportState.setSelectedAngleIndex,
        overlaySettings: exportState.overlaySettings,
        setOverlaySettings: exportState.setOverlaySettings,
        disableExport: Boolean(exportFlow.exportProgress),
      },
      noteDialog: {
        open: notes.noteDialogOpen,
        onClose: dialogHandlers.handleCloseNoteDialog,
        onSave: notes.handleSaveNote,
        initialNote: currentItemState.editingItem?.memo || '',
        itemName: currentItemState.editingItem?.actionName || '',
      },
      progress: {
        saveProgress: core.saveProgress,
        exportProgress: exportFlow.exportProgress,
        onCloseExportProgress: dialogHandlers.handleCloseExportProgress,
      },
    },
  };
};

export type PlaylistWindowController = ReturnType<
  typeof usePlaylistWindowController
>;
