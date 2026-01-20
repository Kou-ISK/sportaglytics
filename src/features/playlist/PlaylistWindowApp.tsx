/**
 * プレイリストウィンドウ専用アプリケーション
 * Sportscode準拠: ウィンドウ内でビデオ再生、連続再生、ループ再生対応
 * 図形・テキスト描画、フリーズフレーム、メモ編集対応
 */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Box } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type {
  PlaylistType,
  ItemAnnotation,
  AnnotationTarget,
} from '../../types/Playlist';
import { AnnotationCanvasRef } from './components/AnnotationCanvas';
import { useTheme } from '@mui/material/styles';
import { usePlaylistHistory } from './hooks/usePlaylistHistory';
import { usePlaylistSelection } from './hooks/usePlaylistSelection';
import { usePlaylistExport } from './hooks/usePlaylistExport';
import { usePlaylistHotkeys } from './hooks/usePlaylistHotkeys';
import { usePlaylistPlayback } from './hooks/usePlaylistPlayback';
import { usePlaylistIpcSync } from './hooks/usePlaylistIpcSync';
import { usePlaylistWindowSync } from './hooks/usePlaylistWindowSync';
import { usePlaylistLoader } from './hooks/usePlaylistLoader';
import { usePlaylistSaveRequest } from './hooks/usePlaylistSaveRequest';
import { usePlaylistVideoSizing } from './hooks/usePlaylistVideoSizing';
import { usePlaylistControlsVisibility } from './hooks/usePlaylistControlsVisibility';
import { usePlaylistDrawingTarget } from './hooks/usePlaylistDrawingTarget';
import { usePlaylistAnnotations } from './hooks/usePlaylistAnnotations';
import { usePlaylistItemOperations } from './hooks/usePlaylistItemOperations';
import { usePlaylistSaveFlow } from './hooks/usePlaylistSaveFlow';
import { usePlaylistHotkeyBindings } from './hooks/usePlaylistHotkeyBindings';
import { usePlaylistNotes } from './hooks/usePlaylistNotes';
import { usePlaylistExportState } from './hooks/usePlaylistExportState';
import { usePlaylistVideoSourcesSync } from './hooks/usePlaylistVideoSourcesSync';
import { usePlaylistCurrentItem } from './hooks/usePlaylistCurrentItem';
import { usePlaylistHistorySync } from './hooks/usePlaylistHistorySync';
import { useGlobalHotkeys } from '../../hooks/useGlobalHotkeys';
import { renderAnnotationPng } from './utils/renderAnnotationPng';
import { PlaylistItemSection } from './components/PlaylistItemSection';
import { PlaylistVideoArea } from './components/PlaylistVideoArea';
import { PlaylistHeaderToolbar } from './components/PlaylistHeaderToolbar';
import { PlaylistNowPlayingInfo } from './components/PlaylistNowPlayingInfo';
import { PlaylistWindowDialogs } from './components/PlaylistWindowDialogs';

const DEFAULT_FREEZE_DURATION = 3; // seconds - Sportscode風の自動停止既定値を少し延長
const MIN_FREEZE_DURATION = 1; // seconds - ユーザー要求の最低停止秒数
const ANNOTATION_TIME_TOLERANCE = 0.12; // 秒: 描画タイミング判定のゆらぎ
const FREEZE_RETRIGGER_GUARD = 0.3; // 秒: 同じタイミングでの連続フリーズ防止

export default function PlaylistWindowApp() {
  const theme = useTheme();
  const { success, error: showError } = useNotification();

  // 履歴管理を統合したアイテム状態（Undo/Redo対応）
  const {
    items,
    setItems: setItemsWithHistory,
    undo,
    redo,
  } = usePlaylistHistory([]);

  // 未保存フラグ
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // State
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
  const isDualView = viewMode === 'dual'; // 互換性のため
  const [playlistName, setPlaylistName] = useState('プレイリスト');
  const [playlistType, setPlaylistType] = useState<PlaylistType>('embedded');
  const [packagePath, setPackagePath] = useState<string | null>(null);

  // Drawing/Annotation state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [itemAnnotations, setItemAnnotations] = useState<
    Record<string, ItemAnnotation>
  >({});
  const [drawingTarget, setDrawingTarget] =
    useState<AnnotationTarget>('primary');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isVideoAreaHovered, setIsVideoAreaHovered] = useState(false);
  const [videoAreaInteractionId, setVideoAreaInteractionId] = useState(0);

  // Freeze frame state
  const [isFrozen, setIsFrozen] = useState(false);

  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [closeAfterSave, setCloseAfterSave] = useState(false);

  // Refs
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

  // 保存進行状況
  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // 変更検知フラグ
  const [isDirty, setIsDirty] = useState(false);
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const {
    currentItem,
    currentVideoSource,
    currentVideoSource2,
    sliderMin,
    sliderMax,
    editingItem,
  } = usePlaylistCurrentItem({
    items,
    currentIndex,
    videoSources,
    duration,
    editingItemId,
  });

  usePlaylistVideoSourcesSync({
    currentItem,
    videoSources,
    setVideoSources,
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

  const { handleRemoveItem, handleDragEnd } = usePlaylistItemOperations({
    currentIndex,
    setCurrentIndex,
    setIsPlaying,
    setItemsWithHistory,
    setItemAnnotations,
    setHasUnsavedChanges,
  });

  const {
    editingItemId,
    noteDialogOpen,
    setNoteDialogOpen,
    handleEditNote,
    handleSaveNote,
  } = usePlaylistNotes({
    setItemsWithHistory,
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Toggle drawing mode
  const handleToggleDrawingMode = useCallback(() => {
    if (isDrawingMode) {
      persistCanvasObjects(annotationCanvasRefPrimary, 'primary');
      persistCanvasObjects(annotationCanvasRefSecondary, 'secondary');
    }
    setIsDrawingMode(!isDrawingMode);
    // Pause video when entering drawing mode
    if (!isDrawingMode) {
      setIsPlaying(false);
    }
  }, [isDrawingMode, persistCanvasObjects, setIsDrawingMode, setIsPlaying]);

  // Hotkey handlers - タイムラインと完全に同じ操作感
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

  // Register hotkeys
  useGlobalHotkeys(
    playlistHotkeys,
    playlistHotkeyHandlers,
    playlistKeyUpHandlers,
  );

  // Load playlist
  const handleLoadPlaylist = useCallback(async () => {
    handleMenuClose();
    await loadPlaylistFromPath();
  }, [handleMenuClose, loadPlaylistFromPath]);

  const { exportProgress, handleExportPlaylist: exportPlaylist } =
    usePlaylistExport({
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
      showError,
      success,
    });

  const handleExportPlaylist = useCallback(() => {
    setExportDialogOpen(false);
    void exportPlaylist();
  }, [exportPlaylist]);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <PlaylistHeaderToolbar
        playlistName={playlistName}
        hasUnsavedChanges={hasUnsavedChanges}
        exportDisabled={!!exportProgress}
        hasDualSources={videoSources.length >= 2}
        anchorEl={anchorEl}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        onSaveClick={() => {
          console.log(
            '[PlaylistWindow] Save button clicked. loadedFilePath:',
            loadedFilePath,
          );
          if (loadedFilePath) {
            console.log(
              '[PlaylistWindow] Saving to existing file:',
              loadedFilePath,
            );
            handleSavePlaylist(false);
          } else {
            console.log('[PlaylistWindow] No loadedFilePath, showing dialog');
            setSaveDialogOpen(true);
          }
        }}
        onSaveAsClick={() => setSaveDialogOpen(true)}
        onLoadClick={handleLoadPlaylist}
        onExportClick={() => setExportDialogOpen(true)}
        onViewModeChange={setViewMode}
      />

        <PlaylistVideoArea
        currentVideoSource={currentVideoSource}
        currentVideoSource2={currentVideoSource2}
        viewMode={viewMode}
        isDrawingMode={isDrawingMode}
        drawingTarget={drawingTarget}
        onDrawingTargetChange={setDrawingTarget}
        annotationCanvasRefPrimary={annotationCanvasRefPrimary}
        annotationCanvasRefSecondary={annotationCanvasRefSecondary}
        primaryCanvasSize={primaryCanvasSize}
        secondaryCanvasSize={secondaryCanvasSize}
        primaryContentRect={primaryContentRect}
        secondaryContentRect={secondaryContentRect}
        currentAnnotation={currentAnnotation}
        defaultFreezeDuration={DEFAULT_FREEZE_DURATION}
        onObjectsChange={handleAnnotationObjectsChange}
        onFreezeDurationChange={handleFreezeDurationChange}
        currentTime={currentTime}
        videoRef={videoRef}
        videoRef2={videoRef2}
        hasItems={items.length > 0}
        controlsVisible={controlsVisible}
        sliderMin={sliderMin}
        sliderMax={sliderMax}
        marks={
          currentAnnotation?.objects?.length
            ? currentAnnotation.objects.map((obj) => ({
                value: obj.timestamp,
                label: '',
              }))
            : []
        }
        isPlaying={isPlaying}
        isFrozen={isFrozen}
        autoAdvance={autoAdvance}
        loopPlaylist={loopPlaylist}
        isMuted={isMuted}
        volume={volume}
        isFullscreen={isFullscreen}
        onSeek={handleSeek}
        onSeekCommitted={() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
        onPrevious={handlePrevious}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
        onToggleLoop={() => setLoopPlaylist(!loopPlaylist)}
        onToggleDrawingMode={handleToggleDrawingMode}
        onToggleMute={() => setIsMuted(!isMuted)}
        onVolumeChange={handleVolumeChange}
          onToggleFullscreen={handleToggleFullscreen}
          onVideoAreaHoverChange={setIsVideoAreaHovered}
          onVideoAreaInteraction={() =>
            setVideoAreaInteractionId((prev) => prev + 1)
          }
          showControls={Boolean(currentItem)}
        />

      <PlaylistItemSection
        items={items}
        currentIndex={currentIndex}
        selectedItemIds={selectedItemIds}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        onRemove={handleRemoveItem}
        onPlay={handlePlayItem}
        onEditNote={handleEditNote}
        onToggleSelect={toggleSelect}
      />

      {currentItem && (
        <PlaylistNowPlayingInfo
          currentItem={currentItem}
          isFrozen={isFrozen}
          currentIndex={currentIndex}
          totalCount={items.length}
          annotation={currentAnnotation}
        />
      )}

      <PlaylistWindowDialogs
        saveDialogOpen={saveDialogOpen}
        onCloseSaveDialog={() => {
          setSaveDialogOpen(false);
          setCloseAfterSave(false);
        }}
        onSavePlaylist={handleSavePlaylistAs}
        defaultPlaylistName={playlistName}
        defaultPlaylistType={playlistType}
        closeAfterSave={closeAfterSave}
        exportDialogOpen={exportDialogOpen}
        onCloseExportDialog={() => setExportDialogOpen(false)}
        onExport={handleExportPlaylist}
        exportFileName={exportFileName}
        setExportFileName={setExportFileName}
        exportScope={exportScope}
        setExportScope={setExportScope}
        selectedItemCount={selectedCount}
        exportMode={exportMode}
        setExportMode={setExportMode}
        angleOption={angleOption}
        setAngleOption={setAngleOption}
        videoSources={videoSources}
        selectedAngleIndex={selectedAngleIndex}
        setSelectedAngleIndex={setSelectedAngleIndex}
        overlaySettings={overlaySettings}
        setOverlaySettings={setOverlaySettings}
        disableExport={!!exportProgress}
        noteDialogOpen={noteDialogOpen}
        onCloseNoteDialog={() => {
          setNoteDialogOpen(false);
          setEditingItemId(null);
        }}
        onSaveNote={handleSaveNote}
        initialNote={editingItem?.memo || ''}
        itemName={editingItem?.actionName || ''}
        saveProgress={saveProgress}
        exportProgress={exportProgress}
        onCloseExportProgress={() => setExportProgress(null)}
      />
    </Box>
  );
}
