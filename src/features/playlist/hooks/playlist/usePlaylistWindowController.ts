import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import type {
  AnnotationTarget,
  ItemAnnotation,
  PlaylistType,
} from '../../../../types/Playlist';
import type { AnnotationCanvasRef } from '../../components/AnnotationCanvas';
import { usePlaylistCurrentItem } from './usePlaylistCurrentItem';
import { usePlaylistDialogHandlers } from './usePlaylistDialogHandlers';
import { usePlaylistDrawingTarget } from './usePlaylistDrawingTarget';
import { usePlaylistExport } from './usePlaylistExport';
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
import { usePlaylistSaveDialogState } from './usePlaylistSaveDialogState';
import { usePlaylistSaveFlow } from './usePlaylistSaveFlow';
import { usePlaylistSaveRequest } from './usePlaylistSaveRequest';
import { usePlaylistSelection } from './usePlaylistSelection';
import { usePlaylistVideoControlsState } from './usePlaylistVideoControlsState';
import { usePlaylistVideoSizing } from './usePlaylistVideoSizing';
import { usePlaylistVideoSourcesSync } from './usePlaylistVideoSourcesSync';
import { usePlaylistWindowSync } from './usePlaylistWindowSync';
import { usePlaylistAnnotations } from './usePlaylistAnnotations';
import { usePlaylistControlsVisibility } from './usePlaylistControlsVisibility';
import { renderAnnotationPng } from '../../utils/renderAnnotationPng';

const DEFAULT_FREEZE_DURATION = 3;
const MIN_FREEZE_DURATION = 1;
const ANNOTATION_TIME_TOLERANCE = 0.12;
const FREEZE_RETRIGGER_GUARD = 0.3;

export const usePlaylistWindowController = () => {
  const { success, error: showError } = useNotification();

  const {
    items,
    setItems: setItemsWithHistory,
    undo,
    redo,
  } = usePlaylistHistory([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopPlaylist, setLoopPlaylist] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSources, setVideoSources] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'dual' | 'angle1' | 'angle2'>(
    'dual',
  );
  const [playlistName, setPlaylistName] = useState('プレイリスト');
  const [playlistType, setPlaylistType] = useState<PlaylistType>('embedded');
  const [packagePath, setPackagePath] = useState<string | null>(null);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [itemAnnotations, setItemAnnotations] = useState<
    Record<string, ItemAnnotation>
  >({});
  const [drawingTarget, setDrawingTarget] =
    useState<AnnotationTarget>('primary');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isVideoAreaHovered, setIsVideoAreaHovered] = useState(false);
  const [videoAreaInteractionId, setVideoAreaInteractionId] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);

  const {
    saveDialogOpen,
    setSaveDialogOpen,
    closeAfterSave,
    setCloseAfterSave,
  } = usePlaylistSaveDialogState();

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationCanvasRefPrimary = useRef<AnnotationCanvasRef>(null);
  const annotationCanvasRefSecondary = useRef<AnnotationCanvasRef>(null);

  const [primaryCanvasSize, setPrimaryCanvasSize] = useState({
    width: 1920,
    height: 1080,
  });
  const [secondaryCanvasSize, setSecondaryCanvasSize] = useState({
    width: 1920,
    height: 1080,
  });
  const [primaryContentRect, setPrimaryContentRect] = useState({
    width: 1920,
    height: 1080,
    offsetX: 0,
    offsetY: 0,
  });
  const [secondaryContentRect, setSecondaryContentRect] = useState({
    width: 1920,
    height: 1080,
    offsetX: 0,
    offsetY: 0,
  });
  const [primarySourceSize, setPrimarySourceSize] = useState({
    width: 1920,
    height: 1080,
  });
  const [secondarySourceSize, setSecondarySourceSize] = useState({
    width: 1920,
    height: 1080,
  });

  const {
    selectedItemIds,
    selectedItems,
    selectedCount,
    toggleSelect,
    deleteSelected,
  } = usePlaylistSelection({
    items,
    setItems: setItemsWithHistory,
    onDirtyChange: setHasUnsavedChanges,
  });

  const {
    exportDialogOpen,
    setExportDialogOpen,
    overlaySettings,
    setOverlaySettings,
    exportMode,
    setExportMode,
    angleOption,
    setAngleOption,
    selectedAngleIndex,
    setSelectedAngleIndex,
    exportFileName,
    setExportFileName,
    exportScope,
    setExportScope,
  } = usePlaylistExportState();

  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const {
    editingItemId,
    noteDialogOpen,
    setNoteDialogOpen,
    setEditingItemId,
    handleEditNote,
    handleSaveNote,
  } = usePlaylistNotes({
    setItemsWithHistory,
    setHasUnsavedChanges,
  });

  const {
    currentItem,
    currentVideoSource,
    currentVideoSource2,
    editingItem,
  } = usePlaylistCurrentItem({
    items,
    currentIndex,
    videoSources,
    duration,
    editingItemId,
  });

  const {
    currentAnnotation,
    persistCanvasObjects,
    handleAnnotationObjectsChange,
    handleFreezeDurationChange,
  } = usePlaylistAnnotations({
    currentItem,
    itemAnnotations,
    setItemAnnotations,
    setItemsWithHistory,
    setHasUnsavedChanges,
    minFreezeDuration: MIN_FREEZE_DURATION,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
  });

  usePlaylistVideoSourcesSync({
    currentItem,
    videoSources,
    setVideoSources,
  });

  const {
    sliderMin,
    sliderMax,
    marks,
    handleSeekCommitted,
    handleToggleAutoAdvance,
    handleToggleLoop,
    handleToggleMute,
  } = usePlaylistVideoControlsState({
    currentItem,
    currentAnnotation,
    duration,
    autoAdvance,
    loopPlaylist,
    isMuted,
    setAutoAdvance,
    setLoopPlaylist,
    setIsMuted,
  });

  usePlaylistDrawingTarget({
    viewMode,
    currentVideoSource2,
    setDrawingTarget,
  });

  usePlaylistVideoSizing({
    videoRef,
    videoRef2,
    currentVideoSource,
    currentVideoSource2,
    viewMode,
    setPrimaryCanvasSize,
    setPrimarySourceSize,
    setPrimaryContentRect,
    setSecondaryCanvasSize,
    setSecondarySourceSize,
    setSecondaryContentRect,
  });

  usePlaylistControlsVisibility({
    isVideoAreaHovered,
    isPlaying,
    isDrawingMode,
    interactionId: videoAreaInteractionId,
    setControlsVisible,
  });

  const { handleRemoveItem, handleDragEnd } = usePlaylistItemOperations({
    currentIndex,
    setCurrentIndex,
    setIsPlaying,
    setItemsWithHistory,
    setItemAnnotations,
    setHasUnsavedChanges,
  });

  usePlaylistIpcSync({
    setItemsWithHistory,
    setPlaylistName,
    setHasUnsavedChanges,
    setItemAnnotations,
    setPlaylistType,
    setPackagePath,
    setVideoSources,
    setViewMode,
    setSaveProgress,
    setIsDirty,
  });

  usePlaylistWindowSync({
    playlistName,
    loadedFilePath,
    isDirty,
  });

  const { loadPlaylistFromPath } = usePlaylistLoader({
    setItemsWithHistory,
    setHasUnsavedChanges,
    setPlaylistName,
    setPlaylistType,
    setPackagePath,
    setLoadedFilePath,
    setIsDirty,
    setItemAnnotations,
    setVideoSources,
    setViewMode,
    setCurrentIndex,
  });

  const {
    handlePlayItem,
    handleTogglePlay,
    handlePrevious,
    handleNext,
    handleSeek,
    handleVolumeChange,
    handleToggleFullscreen,
  } = usePlaylistPlayback({
    items,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    isFrozen,
    setIsFrozen,
    currentItem,
    currentAnnotation: currentAnnotation ?? undefined,
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
    minFreezeDuration: MIN_FREEZE_DURATION,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
    annotationTimeTolerance: ANNOTATION_TIME_TOLERANCE,
    freezeRetriggerGuard: FREEZE_RETRIGGER_GUARD,
  });

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    },
    [],
  );

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleToggleDrawingMode = useCallback(() => {
    if (isDrawingMode) {
      persistCanvasObjects(annotationCanvasRefPrimary, 'primary');
      persistCanvasObjects(annotationCanvasRefSecondary, 'secondary');
    }
    setIsDrawingMode(!isDrawingMode);
    if (!isDrawingMode) {
      setIsPlaying(false);
    }
  }, [isDrawingMode, persistCanvasObjects]);

  const playlistHotkeys = usePlaylistHotkeys();

  const handleDeleteSelected = useCallback(() => {
    deleteSelected();
  }, [deleteSelected]);

  const { handleUndo, handleRedo } = usePlaylistHistorySync({
    undo,
    redo,
    setItemAnnotations,
  });

  const { handleSavePlaylist, handleSavePlaylistAs } = usePlaylistSaveFlow({
    items,
    videoSources,
    packagePath,
    itemAnnotations,
    playlistName,
    playlistType,
    setPlaylistName,
    setPlaylistType,
    setLoadedFilePath,
    setIsDirty,
    setHasUnsavedChanges,
    setSaveDialogOpen,
    setSaveProgress,
  });

  usePlaylistSaveRequest({
    loadedFilePath,
    handleSavePlaylist,
    setCloseAfterSave,
    setSaveDialogOpen,
  });

  const {
    hotkeyHandlers: playlistHotkeyHandlers,
    keyUpHandlers: playlistKeyUpHandlers,
  } = usePlaylistHotkeyBindings({
    currentTime,
    handleTogglePlay,
    handleSeek,
    handlePrevious,
    handleNext,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
    handleSavePlaylist,
    loadedFilePath,
    setSaveDialogOpen,
    setExportDialogOpen,
    setViewMode,
    setIsPlaying,
    videoRef,
    videoRef2,
  });

  useGlobalHotkeys(
    playlistHotkeys,
    playlistHotkeyHandlers,
    playlistKeyUpHandlers,
  );

  const handleLoadPlaylist = useCallback(async () => {
    handleMenuClose();
    await loadPlaylistFromPath();
  }, [handleMenuClose, loadPlaylistFromPath]);

  const {
    exportProgress,
    handleExportPlaylist: exportPlaylist,
    clearExportProgress,
  } = usePlaylistExport({
    items,
    selectedItems,
    videoSources,
    exportScope,
    angleOption,
    selectedAngleIndex,
    exportMode,
    exportFileName,
    overlaySettings,
    itemAnnotations,
    minFreezeDuration: MIN_FREEZE_DURATION,
    primaryContentRect,
    secondaryContentRect,
    primarySourceSize,
    secondarySourceSize,
    renderAnnotationPng,
    onMissingApi: showError,
  });

  const {
    handleCloseSaveDialog,
    handleCloseExportDialog,
    handleCloseNoteDialog,
    handleCloseExportProgress,
  } = usePlaylistDialogHandlers({
    setSaveDialogOpen,
    setCloseAfterSave,
    setExportDialogOpen,
    setNoteDialogOpen,
    setEditingItemId,
    onCloseExportProgress: clearExportProgress,
  });

  const handleExportPlaylist = useCallback(() => {
    setExportDialogOpen(false);
    void exportPlaylist().then((result) => {
      if (!result) return;
      if (result.success) {
        success(result.message);
      } else {
        showError(result.message);
      }
    });
  }, [exportPlaylist, setExportDialogOpen, showError, success]);

  const handleSaveClick = useCallback(() => {
    if (loadedFilePath) {
      handleSavePlaylist(false);
      return;
    }
    setSaveDialogOpen(true);
  }, [handleSavePlaylist, loadedFilePath, setSaveDialogOpen]);

  return {
    containerRef,
    header: {
      playlistName,
      hasUnsavedChanges,
      exportDisabled: !!exportProgress,
      hasDualSources: videoSources.length >= 2,
      anchorEl,
      onMenuOpen: handleMenuOpen,
      onMenuClose: handleMenuClose,
      onSaveClick: handleSaveClick,
      onSaveAsClick: () => setSaveDialogOpen(true),
      onLoadClick: handleLoadPlaylist,
      onExportClick: () => setExportDialogOpen(true),
      onViewModeChange: setViewMode,
    },
    videoArea: {
      currentVideoSource,
      currentVideoSource2,
      viewMode,
      isDrawingMode,
      drawingTarget,
      onDrawingTargetChange: setDrawingTarget,
      annotationCanvasRefPrimary,
      annotationCanvasRefSecondary,
      primaryCanvasSize,
      secondaryCanvasSize,
      primaryContentRect,
      secondaryContentRect,
      currentAnnotation,
      defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
      onObjectsChange: handleAnnotationObjectsChange,
      onFreezeDurationChange: handleFreezeDurationChange,
      currentTime,
      videoRef,
      videoRef2,
      hasItems: items.length > 0,
      controlsVisible,
      sliderMin,
      sliderMax,
      marks,
      isPlaying,
      isFrozen,
      autoAdvance,
      loopPlaylist,
      isMuted,
      volume,
      isFullscreen,
      onSeek: handleSeek,
      onSeekCommitted: handleSeekCommitted,
      onPrevious: handlePrevious,
      onTogglePlay: handleTogglePlay,
      onNext: handleNext,
      onToggleAutoAdvance: handleToggleAutoAdvance,
      onToggleLoop: handleToggleLoop,
      onToggleDrawingMode: handleToggleDrawingMode,
      onToggleMute: handleToggleMute,
      onVolumeChange: handleVolumeChange,
      onToggleFullscreen: handleToggleFullscreen,
      onVideoAreaHoverChange: setIsVideoAreaHovered,
      onVideoAreaInteraction: () =>
        setVideoAreaInteractionId((previous) => previous + 1),
      showControls: Boolean(currentItem),
    },
    itemSection: {
      items,
      currentIndex,
      selectedItemIds,
      sensors,
      onDragEnd: handleDragEnd,
      onRemove: handleRemoveItem,
      onPlay: handlePlayItem,
      onEditNote: handleEditNote,
      onToggleSelect: toggleSelect,
    },
    nowPlaying: currentItem
      ? {
          currentItem,
          isFrozen,
          currentIndex,
          totalCount: items.length,
          annotation: currentAnnotation ?? undefined,
        }
      : null,
    dialogs: {
      saveDialog: {
        open: saveDialogOpen,
        onClose: handleCloseSaveDialog,
        onSave: handleSavePlaylistAs,
        defaultName: playlistName,
        defaultType: playlistType,
        closeAfterSave,
      },
      exportDialog: {
        open: exportDialogOpen,
        onClose: handleCloseExportDialog,
        onExport: handleExportPlaylist,
        exportFileName,
        setExportFileName,
        exportScope,
        setExportScope,
        selectedItemCount: selectedCount,
        exportMode,
        setExportMode,
        angleOption,
        setAngleOption,
        videoSources,
        selectedAngleIndex,
        setSelectedAngleIndex,
        overlaySettings,
        setOverlaySettings,
        disableExport: !!exportProgress,
      },
      noteDialog: {
        open: noteDialogOpen,
        onClose: handleCloseNoteDialog,
        onSave: handleSaveNote,
        initialNote: editingItem?.memo || '',
        itemName: editingItem?.actionName || '',
      },
      progress: {
        saveProgress,
        exportProgress,
        onCloseExportProgress: handleCloseExportProgress,
      },
    },
  };
};

export type PlaylistWindowController = ReturnType<
  typeof usePlaylistWindowController
>;
