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
  useMemo,
} from 'react';
import { Box } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type {
  PlaylistItem,
  PlaylistType,
  DrawingObject,
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
import { useGlobalHotkeys } from '../../hooks/useGlobalHotkeys';
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
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showMemo: true,
  });
  const [exportMode, setExportMode] = useState<
    'single' | 'perInstance' | 'perRow'
  >('single');
  const [angleOption, setAngleOption] = useState<
    'allAngles' | 'single' | 'multi'
  >('single');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number>(0);
  const [exportFileName, setExportFileName] = useState('');
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
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');

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

  // Current item
  const currentItem = useMemo(() => {
    return currentIndex >= 0 && currentIndex < items.length
      ? items[currentIndex]
      : null;
  }, [items, currentIndex]);

  // Get video source for current item (primary)
  const currentVideoSource = useMemo(() => {
    if (!currentItem) return null;
    return currentItem.videoSource || videoSources[0] || null;
  }, [currentItem, videoSources]);

  // Get video source for current item (secondary)
  // viewModeに関係なく常にソースを取得（表示制御はUI側で行う）
  const currentVideoSource2 = useMemo(() => {
    if (!currentItem) return null;
    return currentItem.videoSource2 || videoSources[1] || null;
  }, [currentItem, videoSources]);

  // Keep videoSources in sync with the currently selected item (supports mixed packages)
  useEffect(() => {
    if (!currentItem) return;
    const merged: string[] = [];
    if (currentItem.videoSource) merged.push(currentItem.videoSource);
    if (currentItem.videoSource2) merged.push(currentItem.videoSource2);
    // Fallback to previously known sources when item lacks one of them
    if (!currentItem.videoSource && videoSources[0])
      merged.unshift(videoSources[0]);
    if (!currentItem.videoSource2 && videoSources[1]) {
      if (merged.length === 0) merged.push('');
      merged[1] = videoSources[1];
    }
    const cleaned = merged.filter(Boolean);
    if (
      cleaned.length &&
      JSON.stringify(cleaned) !== JSON.stringify(videoSources)
    ) {
      setVideoSources(cleaned);
    }
  }, [currentItem, videoSources]);

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

  const handleRemoveItem = useCallback(
    (id: string) => {
      setItemsWithHistory((prev) => {
        const newItems = prev.filter((item) => item.id !== id);
        const removedIndex = prev.findIndex((item) => item.id === id);
        if (removedIndex <= currentIndex && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else if (removedIndex === currentIndex) {
          setIsPlaying(false);
          if (newItems.length === 0) {
            setCurrentIndex(-1);
          }
        }
        return newItems;
      });
      // Remove annotation
      setItemAnnotations((prev) => {
        const newAnnotations = { ...prev };
        delete newAnnotations[id];
        return newAnnotations;
      });
      setHasUnsavedChanges(true);
    },
    [currentIndex, setItemsWithHistory],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setItemsWithHistory((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id);
        const newIndex = prev.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(prev, oldIndex, newIndex);

        if (oldIndex === currentIndex) {
          setCurrentIndex(newIndex);
        } else if (oldIndex < currentIndex && newIndex >= currentIndex) {
          setCurrentIndex(currentIndex - 1);
        } else if (oldIndex > currentIndex && newIndex <= currentIndex) {
          setCurrentIndex(currentIndex + 1);
        }

        return newItems;
      });
      setHasUnsavedChanges(true);
    },
    [currentIndex, setItemsWithHistory],
  );

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

  const handleUndo = useCallback(() => {
    const prevItems = undo();
    if (prevItems) {
      // Annotationsも再構築
      const annotations: Record<string, ItemAnnotation> = {};
      for (const item of prevItems) {
        if (item.annotation) {
          annotations[item.id] = item.annotation;
        }
      }
      setItemAnnotations(annotations);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const nextItems = redo();
    if (nextItems) {
      // Annotationsも再構築
      const annotations: Record<string, ItemAnnotation> = {};
      for (const item of nextItems) {
        if (item.annotation) {
          annotations[item.id] = item.annotation;
        }
      }
      setItemAnnotations(annotations);
    }
  }, [redo]);

  // Save playlist (上書き保存)
  const handleSavePlaylist = useCallback(
    async (shouldCloseAfterSave = false) => {
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) return;

      // Merge annotations into items
      const itemsWithAnnotations = items.map((item) => ({
        ...item,
        // 参照プレイリストでも追加時のソースを保持しておく（複数パッケージ混在を許容）
        videoSource: item.videoSource ?? videoSources[0] ?? undefined,
        videoSource2: item.videoSource2 ?? videoSources[1] ?? undefined,
        annotation: itemAnnotations[item.id] || item.annotation,
      }));

      const playlist = {
        id: crypto.randomUUID(),
        name: playlistName,
        type: playlistType,
        items: itemsWithAnnotations,
        sourcePackagePath: packagePath || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setSaveProgress(null); // 保存開始時に進行状況をリセット
      const savedPath = await playlistAPI.savePlaylistFile(playlist);
      setSaveProgress(null); // 保存完了後に進行状況をクリア

      if (savedPath) {
        console.log('[PlaylistWindow] Playlist saved to:', savedPath);

        // 保存後にウィンドウを閉じる場合
        if (shouldCloseAfterSave) {
          // Electron側に保存完了を通知し、Electron側からウィンドウを閉じる
          // （状態更新はせず、即座にウィンドウを閉じる）
          window.electronAPI?.send?.('playlist:saved-and-close');
        } else {
          // 通常の保存時はReact状態を更新してElectron側と同期
          setLoadedFilePath(savedPath);
          setIsDirty(false);
          setHasUnsavedChanges(false); // ← 追加
          playlistAPI.sendCommand({ type: 'set-dirty', isDirty: false });
        }
      }
    },
    [
      items,
      videoSources,
      packagePath,
      itemAnnotations,
      playlistName,
      playlistType,
    ],
  );

  usePlaylistSaveRequest({
    loadedFilePath,
    handleSavePlaylist,
    setCloseAfterSave,
    setSaveDialogOpen,
  });

  // Save playlist as (名前を付けて保存)
  const handleSavePlaylistAs = useCallback(
    async (type: PlaylistType, name: string, shouldCloseAfterSave = false) => {
      setSaveDialogOpen(false);
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) return;

      // Merge annotations into items
      const itemsWithAnnotations = items.map((item) => ({
        ...item,
        // 参照プレイリストでも追加時のソースを保持しておく（複数パッケージ混在を許容）
        videoSource: item.videoSource ?? videoSources[0] ?? undefined,
        videoSource2: item.videoSource2 ?? videoSources[1] ?? undefined,
        annotation: itemAnnotations[item.id] || item.annotation,
      }));

      const playlist = {
        id: crypto.randomUUID(),
        name,
        type,
        items: itemsWithAnnotations,
        sourcePackagePath: packagePath || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setSaveProgress(null); // 保存開始時に進行状況をリセット
      const savedPath = await playlistAPI.savePlaylistFileAs(playlist);
      setSaveProgress(null); // 保存完了後に進行状況をクリア

      if (savedPath) {
        console.log('[PlaylistWindow] Playlist saved to:', savedPath);

        // 保存後にウィンドウを閉じる場合
        if (shouldCloseAfterSave) {
          // Electron側に保存完了を通知し、Electron側からウィンドウを閉じる
          // （状態更新はせず、即座にウィンドウを閉じる）
          window.electronAPI?.send?.('playlist:saved-and-close');
        } else {
          // 通常の保存時はReact状態を更新してElectron側と同期
          setPlaylistName(name);
          setPlaylistType(type);
          setLoadedFilePath(savedPath);
          setIsDirty(false);
          playlistAPI.sendCommand({ type: 'set-dirty', isDirty: false });
        }
      }
    },
    [items, videoSources, packagePath, itemAnnotations],
  );

  const playlistHotkeyHandlers = useMemo(
    () => ({
      'play-pause': handleTogglePlay,
      'skip-backward-medium': () => {
        const newTime = currentTime - 5;
        handleSeek(new Event('hotkey'), newTime);
      },
      'skip-backward-large': () => {
        const newTime = currentTime - 10;
        handleSeek(new Event('hotkey'), newTime);
      },
      // 倍速再生（タイムラインと同じ実装パターン）
      'skip-forward-small': () => {
        if (videoRef.current) videoRef.current.playbackRate = 0.5;
        if (videoRef2.current) videoRef2.current.playbackRate = 0.5;
        setIsPlaying(true);
      },
      'skip-forward-medium': () => {
        if (videoRef.current) videoRef.current.playbackRate = 2;
        if (videoRef2.current) videoRef2.current.playbackRate = 2;
        setIsPlaying(true);
      },
      'skip-forward-large': () => {
        if (videoRef.current) videoRef.current.playbackRate = 4;
        if (videoRef2.current) videoRef2.current.playbackRate = 4;
        setIsPlaying(true);
      },
      'skip-forward-xlarge': () => {
        if (videoRef.current) videoRef.current.playbackRate = 6;
        if (videoRef2.current) videoRef2.current.playbackRate = 6;
        setIsPlaying(true);
      },
      'previous-item': handlePrevious,
      'next-item': handleNext,
      'delete-item': handleDeleteSelected,
      undo: handleUndo,
      redo: handleRedo,
      save: () => {
        console.log(
          '[PlaylistWindow] Hotkey Save pressed. loadedFilePath:',
          loadedFilePath,
        );
        // 既存ファイルがあれば即座に上書き保存、なければダイアログ表示
        if (loadedFilePath) {
          console.log('[PlaylistWindow] Saving via hotkey to:', loadedFilePath);
          handleSavePlaylist(false);
        } else {
          console.log(
            '[PlaylistWindow] No loadedFilePath, showing dialog via hotkey',
          );
          setSaveDialogOpen(true);
        }
      },
      export: () => setExportDialogOpen(true),
      'toggle-angle1': () => {
        setViewMode((prev) => {
          // dual→angle1, angle1→dual, angle2→angle1
          if (prev === 'dual') return 'angle1';
          if (prev === 'angle1') return 'dual';
          if (prev === 'angle2') return 'angle1';
          return 'angle1';
        });
      },
      'toggle-angle2': () => {
        setViewMode((prev) => {
          // dual→angle2, angle2→dual, angle1→angle2
          if (prev === 'dual') return 'angle2';
          if (prev === 'angle2') return 'dual';
          if (prev === 'angle1') return 'angle2';
          return 'angle2';
        });
      },
    }),
    [
      handleTogglePlay,
      currentTime,
      handleSeek,
      handlePrevious,
      handleNext,
      handleDeleteSelected,
      handleUndo,
      handleRedo,
      handleSavePlaylist,
      loadedFilePath,
    ],
  );

  // keyUp時に再生速度を戻す（タイムラインと同じ）
  const playlistKeyUpHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-medium': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-large': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-xlarge': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
    }),
    [],
  );

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

  // Edit note
  const handleEditNote = useCallback((itemId: string) => {
    setEditingItemId(itemId);
    setNoteDialogOpen(true);
  }, []);

  const handleSaveNote = useCallback(
    (note: string) => {
      if (!editingItemId) return;
      setItemsWithHistory((prev: PlaylistItem[]) =>
        prev.map((item: PlaylistItem) =>
          item.id === editingItemId ? { ...item, note } : item,
        ),
      );
      setNoteDialogOpen(false);
      setEditingItemId(null);
      setHasUnsavedChanges(true);
    },
    [editingItemId, setItemsWithHistory],
  );

  const renderAnnotationPng = useCallback(
    (
      objects: DrawingObject[] | undefined,
      target: AnnotationTarget,
      fallbackSize: { width: number; height: number },
      targetSize?: { width: number; height: number },
    ) => {
      const filtered =
        objects?.filter((o) => (o.target || 'primary') === target) || [];
      if (filtered.length === 0) return null;
      const baseWidth =
        filtered.find((o) => o.baseWidth)?.baseWidth ||
        fallbackSize.width ||
        1920;
      const baseHeight =
        filtered.find((o) => o.baseHeight)?.baseHeight ||
        fallbackSize.height ||
        1080;
      const targetW = targetSize?.width || baseWidth;
      const targetH = targetSize?.height || baseHeight;
      const scaleX = targetW / baseWidth;
      const scaleY = targetH / baseHeight;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const draw = (obj: DrawingObject) => {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.strokeWidth * ((scaleX + scaleY) / 2);
        switch (obj.type) {
          case 'pen':
            if (obj.path && obj.path.length > 1) {
              ctx.beginPath();
              ctx.moveTo(obj.path[0].x * scaleX, obj.path[0].y * scaleY);
              for (let i = 1; i < obj.path.length; i++) {
                ctx.lineTo(obj.path[i].x * scaleX, obj.path[i].y * scaleY);
              }
              ctx.stroke();
            }
            break;
          case 'line':
            if (obj.endX !== undefined && obj.endY !== undefined) {
              ctx.beginPath();
              ctx.moveTo(obj.startX * scaleX, obj.startY * scaleY);
              ctx.lineTo(obj.endX * scaleX, obj.endY * scaleY);
              ctx.stroke();
            }
            break;
          case 'arrow':
            if (obj.endX !== undefined && obj.endY !== undefined) {
              ctx.beginPath();
              ctx.moveTo(obj.startX * scaleX, obj.startY * scaleY);
              ctx.lineTo(obj.endX * scaleX, obj.endY * scaleY);
              ctx.stroke();
            }
            break;
          case 'rectangle':
            if (obj.endX !== undefined && obj.endY !== undefined) {
              ctx.strokeRect(
                obj.startX * scaleX,
                obj.startY * scaleY,
                (obj.endX - obj.startX) * scaleX,
                (obj.endY - obj.startY) * scaleY,
              );
            }
            break;
          case 'circle':
            if (obj.endX !== undefined && obj.endY !== undefined) {
              const radiusX = (Math.abs(obj.endX - obj.startX) / 2) * scaleX;
              const radiusY = (Math.abs(obj.endY - obj.startY) / 2) * scaleY;
              const centerX = ((obj.startX + obj.endX) / 2) * scaleX;
              const centerY = ((obj.startY + obj.endY) / 2) * scaleY;
              ctx.beginPath();
              ctx.ellipse(
                centerX,
                centerY,
                radiusX,
                radiusY,
                0,
                0,
                Math.PI * 2,
              );
              ctx.stroke();
            }
            break;
          case 'text':
            if (obj.text) {
              ctx.font = `${(obj.fontSize || 24) * ((scaleX + scaleY) / 2)}px sans-serif`;
              ctx.fillText(obj.text, obj.startX * scaleX, obj.startY * scaleY);
            }
            break;
          default:
            break;
        }
      };
      filtered.forEach(draw);
      return canvas.toDataURL('image/png');
    },
    [],
  );

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

  const sliderMin = currentItem?.startTime ?? 0;
  const sliderMax = currentItem?.endTime ?? duration;
  const editingItem = editingItemId
    ? items.find((i) => i.id === editingItemId)
    : null;

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
