import { useNotification } from '../../../../contexts/NotificationContext';
import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import { renderAnnotationPng } from '../../utils/renderAnnotationPng';
import {
  ANNOTATION_TIME_TOLERANCE,
  DEFAULT_FREEZE_DURATION,
  FREEZE_RETRIGGER_GUARD,
  MIN_FREEZE_DURATION,
} from './playlistWindowController.constants';
import { usePlaylistAnnotations } from './usePlaylistAnnotations';
import { usePlaylistControlsVisibility } from './usePlaylistControlsVisibility';
import { usePlaylistCurrentItem } from './usePlaylistCurrentItem';
import { usePlaylistDndSensors } from './usePlaylistDndSensors';
import { usePlaylistDialogHandlers } from './usePlaylistDialogHandlers';
import { usePlaylistDrawingModeToggle } from './usePlaylistDrawingModeToggle';
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
import { usePlaylistWindowSections } from './usePlaylistWindowSections';
import { usePlaylistWindowSync } from './usePlaylistWindowSync';

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

  const sensors = usePlaylistDndSensors();

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

  const handleToggleDrawingMode = usePlaylistDrawingModeToggle({
    isDrawingMode: core.isDrawingMode,
    setIsDrawingMode: core.setIsDrawingMode,
    setIsPlaying: core.setIsPlaying,
    persistCanvasObjects: annotations.persistCanvasObjects,
    annotationCanvasRefPrimary: core.annotationCanvasRefPrimary,
    annotationCanvasRefSecondary: core.annotationCanvasRefSecondary,
  });

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

  const { header, videoArea, itemSection, nowPlaying, dialogs } =
    usePlaylistWindowSections({
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
      defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
    });

  return {
    containerRef: core.containerRef,
    header,
    videoArea,
    itemSection,
    nowPlaying,
    dialogs,
  };
};

export type PlaylistWindowController = ReturnType<
  typeof usePlaylistWindowController
>;
