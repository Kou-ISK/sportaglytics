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
  useLayoutEffect,
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
  PlaylistSyncData,
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
import { useGlobalHotkeys } from '../../hooks/useGlobalHotkeys';
import type { HotkeyConfig } from '../../types/Settings';
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
  const lastFreezeTimestampRef = useRef<number | null>(null);
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

  useEffect(() => {
    // angle1のみの場合はprimary、angle2のみの場合はsecondaryに固定
    if (viewMode === 'angle1') {
      setDrawingTarget('primary');
    } else if (viewMode === 'angle2') {
      setDrawingTarget('secondary');
    } else if (!currentVideoSource2) {
      setDrawingTarget('primary');
    }
  }, [viewMode, currentVideoSource2]);

  useEffect(() => {
    lastFreezeTimestampRef.current = null;
  }, [currentItem?.id]);

  // Sync canvas size to rendered video size (avoid aspect ratio drift)
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      const containerWidth = video.clientWidth || 1920;
      const containerHeight = video.clientHeight || 1080;
      setPrimaryCanvasSize({
        width: containerWidth,
        height: containerHeight,
      });
      const naturalWidth = video.videoWidth || containerWidth;
      const naturalHeight = video.videoHeight || containerHeight;
      if (naturalWidth && naturalHeight) {
        setPrimarySourceSize({ width: naturalWidth, height: naturalHeight });
      }
      const scale = Math.min(
        containerWidth / naturalWidth,
        containerHeight / naturalHeight,
      );
      const displayWidth = naturalWidth * scale;
      const displayHeight = naturalHeight * scale;
      setPrimaryContentRect({
        width: displayWidth,
        height: displayHeight,
        offsetX: (containerWidth - displayWidth) / 2,
        offsetY: (containerHeight - displayHeight) / 2,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(video);
    return () => ro.disconnect();
  }, [currentVideoSource, viewMode]);

  useLayoutEffect(() => {
    const video = videoRef2.current;
    if (!video) return;
    const update = () => {
      const containerWidth = video.clientWidth || 1920;
      const containerHeight = video.clientHeight || 1080;
      setSecondaryCanvasSize({
        width: containerWidth,
        height: containerHeight,
      });
      const naturalWidth = video.videoWidth || containerWidth;
      const naturalHeight = video.videoHeight || containerHeight;
      if (naturalWidth && naturalHeight) {
        setSecondarySourceSize({ width: naturalWidth, height: naturalHeight });
      }
      const scale = Math.min(
        containerWidth / naturalWidth,
        containerHeight / naturalHeight,
      );
      const displayWidth = naturalWidth * scale;
      const displayHeight = naturalHeight * scale;
      setSecondaryContentRect({
        width: displayWidth,
        height: displayHeight,
        offsetX: (containerWidth - displayWidth) / 2,
        offsetY: (containerHeight - displayHeight) / 2,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(video);
    return () => ro.disconnect();
  }, [currentVideoSource2, viewMode]);

  // Auto-hide controls overlay - ビデオエリアホバー時のみ表示
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      setControlsVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isDrawingMode && isPlaying) {
          setControlsVisible(false);
        }
      }, 1800);
    };

    // 初期表示
    if (isPlaying && !isDrawingMode) {
      show();
    }
    const handleMove = () => show();
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', () => setControlsVisible(false));

    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', () =>
        setControlsVisible(false),
      );
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isPlaying, isDrawingMode]);

  // Current annotation
  const currentAnnotation = useMemo(() => {
    if (!currentItem) return null;
    const base =
      itemAnnotations[currentItem.id] || currentItem.annotation || null;
    if (base) {
      return {
        ...base,
        objects: base.objects || [],
        freezeAt: base.freezeAt ?? 0,
        freezeDuration:
          base.freezeDuration === undefined || base.freezeDuration === 0
            ? DEFAULT_FREEZE_DURATION
            : base.freezeDuration,
      };
    }
    return {
      objects: [],
      freezeDuration: DEFAULT_FREEZE_DURATION,
      freezeAt: 0,
    };
  }, [currentItem, itemAnnotations]);

  const annotationObjects = currentAnnotation?.objects || [];

  // embedded型プレイリストの場合、保存されている相対時刻を絶対時刻に変換して表示
  const adjustedAnnotationObjects = useMemo(() => {
    if (!currentItem) return annotationObjects;

    const isEmbedded = currentItem.videoSource?.startsWith('./videos/');
    if (!isEmbedded || currentItem.startTime === undefined) {
      return annotationObjects;
    }

    // 相対時刻を絶対時刻に変換
    return annotationObjects.map((obj) => ({
      ...obj,
      timestamp: obj.timestamp + currentItem.startTime,
    }));
  }, [annotationObjects, currentItem]);

  const primaryAnnotationObjects = useMemo(
    () =>
      adjustedAnnotationObjects.filter(
        (obj) => (obj.target || 'primary') === 'primary',
      ),
    [adjustedAnnotationObjects],
  );
  const secondaryAnnotationObjects = useMemo(
    () =>
      adjustedAnnotationObjects.filter(
        (obj) => (obj.target || 'primary') === 'secondary',
      ),
    [adjustedAnnotationObjects],
  );

  // Handle IPC messages from main process
  useEffect(() => {
    const playlistAPI = window.electronAPI?.playlist;

    const handlePlaylistSync = (data: PlaylistSyncData) => {
      console.log('[PlaylistWindow] Received sync data:', data);
      const activePlaylist = data.state.playlists.find(
        (p) => p.id === data.state.activePlaylistId,
      );
      if (activePlaylist) {
        // ファイル読み込み時は履歴に追加しない（usePlaylistHistoryが自動処理）
        setItemsWithHistory(activePlaylist.items);
        setPlaylistName(activePlaylist.name);
        setHasUnsavedChanges(false);
        // Load annotations from items
        const annotations: Record<string, ItemAnnotation> = {};
        for (const item of activePlaylist.items) {
          if (item.annotation) {
            annotations[item.id] = item.annotation;
          }
        }
        setItemAnnotations(annotations);
      }
      setPackagePath(data.packagePath || null);

      // アイテム側にソースが付いている場合はそれを優先し、グローバルなvideoSourcesで上書きしない
      const hasItemSources =
        activePlaylist?.items?.some(
          (it) => !!it.videoSource || !!it.videoSource2,
        ) ?? false;
      if (!hasItemSources) {
        setVideoSources(data.videoSources || []);
        if (data.videoSources && data.videoSources.length >= 2) {
          setViewMode('dual');
        }
      } else {
        // アイテム別ソースがある場合は、現在のアイテムの有無でデュアル判定
        const current = activePlaylist?.items.find(
          (it) => it.id === data.state.playingItemId,
        );
        const hasDual = !!(
          current?.videoSource2 ||
          activePlaylist?.items.some((it) => !!it.videoSource2)
        );
        setViewMode(hasDual ? 'dual' : 'angle1');
      }
    };

    const handleSaveProgress = (data: { current: number; total: number }) => {
      setSaveProgress(data);
    };

    if (playlistAPI) {
      playlistAPI.onSync(handlePlaylistSync);
      playlistAPI.onSaveProgress(handleSaveProgress);
      playlistAPI.sendCommand({ type: 'request-sync' });
    }

    return () => {
      if (playlistAPI) {
        playlistAPI.offSync(handlePlaylistSync);
      }
    };
  }, []);

  // Trigger freeze frame
  const triggerFreezeFrame = useCallback(
    (freezeDuration: number) => {
      const duration = Math.max(MIN_FREEZE_DURATION, freezeDuration);
      if (isFrozen || duration <= 0) return;

      const video = videoRef.current;
      const video2 = videoRef2.current;

      if (video) {
        video.pause();
      }
      if (video2) {
        video2.pause();
      }

      setIsFrozen(true);
      setIsPlaying(false);
    },
    [isFrozen],
  );

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isFrozen) return;
      const playbackTime = video.currentTime;
      setCurrentTime(playbackTime);

      // Check for freeze frame trigger (annotation timestamp)
      if (currentItem && currentAnnotation) {
        const referenceTime = playbackTime;
        const effectiveFreezeDuration =
          currentAnnotation.freezeDuration &&
          currentAnnotation.freezeDuration > 0
            ? Math.max(MIN_FREEZE_DURATION, currentAnnotation.freezeDuration)
            : DEFAULT_FREEZE_DURATION;
        // アノテーションのtimestampに到達したらフリーズ
        const shouldFreeze = currentAnnotation.objects.some(
          (obj) =>
            Math.abs(referenceTime - obj.timestamp) < ANNOTATION_TIME_TOLERANCE,
        );
        const lastFreezeAt = lastFreezeTimestampRef.current;
        const recentlyFrozen =
          lastFreezeAt !== null &&
          Math.abs(referenceTime - lastFreezeAt) < FREEZE_RETRIGGER_GUARD;
        if (
          currentAnnotation.objects.length > 0 &&
          shouldFreeze &&
          !isFrozen &&
          !recentlyFrozen
        ) {
          lastFreezeTimestampRef.current = referenceTime;
          triggerFreezeFrame(effectiveFreezeDuration);
        }
      }

      // Check for item end
      if (currentItem && video.currentTime >= currentItem.endTime) {
        handleItemEnd();
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (currentItem) {
        video.currentTime = currentItem.startTime;
      }
    };

    const handleEnded = () => {
      handleItemEnd();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentItem, currentAnnotation, isFrozen, triggerFreezeFrame]);

  const handleItemEnd = useCallback(() => {
    // Clear any freeze state
    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);

    if (!autoAdvance) {
      setIsPlaying(false);
      return;
    }
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
    }
  }, [autoAdvance, currentIndex, items.length, loopPlaylist]);

  // Play/pause handling for both videos
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video || !currentVideoSource) return;

    if (isPlaying && !isFrozen) {
      // viewModeに応じてvideoを再生
      if (viewMode !== 'angle2') {
        video.play().catch(console.error);
      }
      // viewModeに応じてvideo2を再生
      if (video2 && currentVideoSource2 && viewMode !== 'angle1') {
        video2.play().catch(console.error);
      }
    } else {
      video.pause();
      if (video2) {
        video2.pause();
      }
    }
  }, [isPlaying, isFrozen, currentVideoSource, currentVideoSource2, viewMode]);

  // Volume handling
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    if (video2) {
      video2.volume = 0;
    }
  }, [volume, isMuted]);

  // Set video source when item changes (primary)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoSource || !currentItem) return;

    // Reset freeze state
    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);

    video.src = currentVideoSource;
    video.load();
    video.currentTime = currentItem.startTime;
    setCurrentTime(currentItem.startTime); // 即座にステートも更新

    if (isPlaying) {
      video.play().catch(console.error);
    }
  }, [currentVideoSource, currentItem?.id]);

  // Set video source when item changes (secondary)
  useEffect(() => {
    const video2 = videoRef2.current;
    if (!video2 || !currentVideoSource2 || !currentItem) return;

    video2.src = currentVideoSource2;
    video2.load();
    video2.currentTime = currentItem.startTime;
    video2.volume = 0;

    if (isPlaying && !isFrozen) {
      video2.play().catch(console.error);
    }
  }, [currentVideoSource2, currentItem?.id]);

  // viewMode切り替え時に再生位置を同期
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video || !video2) return;
    if (!currentVideoSource || !currentVideoSource2) return;

    if (viewMode === 'angle2') {
      // angle2表示中: videoのcurrentTimeをvideo2に合わせる
      video.currentTime = video2.currentTime;
    } else if (viewMode === 'angle1') {
      // angle1表示中: video2のcurrentTimeをvideoに合わせる
      video2.currentTime = video.currentTime;
    } else if (viewMode === 'dual') {
      // dual表示中: 再生位置がズレている場合は同期
      const timeDiff = Math.abs(video.currentTime - video2.currentTime);
      if (timeDiff > 0.1) {
        video2.currentTime = video.currentTime;
      }
    }
  }, [viewMode, currentVideoSource, currentVideoSource2]);

  // 外部からのアイテム追加を受信
  useEffect(() => {
    const handleAddItem = (item: PlaylistItem) => {
      setItemsWithHistory((prev: PlaylistItem[]) => [...prev, item]);
      setHasUnsavedChanges(true);
      setIsDirty(true);
    };

    window.electronAPI?.playlist.onAddItem(handleAddItem);

    return () => {
      window.electronAPI?.playlist.offAddItem(handleAddItem);
    };
  }, []);

  // ウィンドウタイトルを更新
  useEffect(() => {
    const title = isDirty
      ? `${playlistName} *`
      : loadedFilePath
        ? playlistName
        : playlistName;
    window.electronAPI?.playlist.setWindowTitle(title);
  }, [isDirty, playlistName, loadedFilePath]);

  // hasUnsavedChanges と isDirty を同期（hasUnsavedChanges を単一の変更検知ソースに統一）
  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  // isDirtyフラグをElectron側に同期
  useEffect(() => {
    window.electronAPI?.playlist.sendCommand({
      type: 'set-dirty',
      isDirty,
    });
  }, [isDirty]);

  // Handlers
  const handlePlayItem = useCallback(
    (id?: string) => {
      if (id) {
        const index = items.findIndex((item) => item.id === id);
        if (index !== -1) {
          setCurrentIndex(index);
          setIsPlaying(true);
          setIsDrawingMode(false); // Exit drawing mode when changing item
        }
      } else if (currentIndex >= 0) {
        setIsPlaying(true);
      } else if (items.length > 0) {
        setCurrentIndex(0);
        setIsPlaying(true);
      }
    },
    [items, currentIndex],
  );

  const handleTogglePlay = useCallback(() => {
    if (isFrozen) {
      // Skip freeze and continue
      setIsFrozen(false);
      setIsPlaying(true);
      return;
    }

    if (currentIndex < 0 && items.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [currentIndex, items.length, isPlaying, isFrozen]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(items.length - 1);
      setIsPlaying(true);
    }
  }, [currentIndex, loopPlaylist, items.length]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [currentIndex, items.length, loopPlaylist]);

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

  const handleSeek = useCallback(
    (event: Event, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value;
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      // videoSource2が存在する場合は常に同期（表示されていなくても）
      if (videoRef2.current && currentVideoSource2) {
        videoRef2.current.currentTime = time;
      }
      lastFreezeTimestampRef.current = null;
      setIsFrozen(false);

      // フォーカスを外してホットキーを有効にする
      if (event.target && 'blur' in event.target) {
        (event.target as HTMLElement).blur();
      }
      // 確実にフォーカスを外す
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [currentVideoSource2],
  );

  const handleVolumeChange = useCallback(
    (_: Event, value: number | number[]) => {
      setVolume(Array.isArray(value) ? value[0] : value);
    },
    [],
  );

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Toggle drawing mode
  const handleToggleDrawingMode = useCallback(() => {
    if (isDrawingMode) {
      // Save current annotation when exiting drawing mode (both views)
      const persistCanvasObjects = (
        ref: React.RefObject<AnnotationCanvasRef | null>,
        target: AnnotationTarget,
      ) => {
        if (!currentItem || !ref.current) return;
        const objects = ref.current.getObjects();
        const currentAnn = itemAnnotations[currentItem.id] || {
          objects: [],
          freezeDuration: DEFAULT_FREEZE_DURATION,
          freezeAt: 0,
        };
        const normalized = objects.map((obj) => ({
          ...obj,
          target: obj.target || target,
        }));
        const otherObjects = currentAnn.objects.filter(
          (obj) => (obj.target || 'primary') !== target,
        );
        const mergedObjects = [...normalized, ...otherObjects];
        const newAnnotation = {
          ...currentAnn,
          objects: mergedObjects,
          freezeDuration: currentAnn.freezeDuration ?? DEFAULT_FREEZE_DURATION,
        };
        setItemAnnotations((prev) => ({
          ...prev,
          [currentItem.id]: newAnnotation,
        }));
        setItemsWithHistory((prev: PlaylistItem[]) =>
          prev.map((item: PlaylistItem) =>
            item.id === currentItem.id
              ? { ...item, annotation: newAnnotation }
              : item,
          ),
        );
        setHasUnsavedChanges(true);
      };

      persistCanvasObjects(annotationCanvasRefPrimary, 'primary');
      persistCanvasObjects(annotationCanvasRefSecondary, 'secondary');
    }
    setIsDrawingMode(!isDrawingMode);
    // Pause video when entering drawing mode
    if (!isDrawingMode) {
      setIsPlaying(false);
    }
  }, [isDrawingMode, currentItem, itemAnnotations]);

  // Handle annotation changes
  const handleAnnotationObjectsChange = useCallback(
    (objects: DrawingObject[], target: AnnotationTarget = 'primary') => {
      if (!currentItem) return;
      const currentAnn = itemAnnotations[currentItem.id] || {
        objects: [],
        freezeDuration: DEFAULT_FREEZE_DURATION,
        freezeAt: 0,
      };

      // プレイリストタイプに応じてタイムスタンプを調整
      // embedded型: アイテム内相対時刻に変換（切り出し動画用）
      // reference型: 元動画の絶対時刻のまま保持
      const normalizedObjects = objects.map((obj) => {
        let adjustedTimestamp = obj.timestamp;

        // embedded型プレイリストの場合、タイムスタンプを相対時刻に変換
        // （将来的に保存時のタイプを参照するため、現在のsaveTypeは使わない）
        // 現在のcurrentTimeは元動画の絶対時刻なので、startTimeを引いて相対時刻にする
        // ただし、reference型プレイリストの場合は絶対時刻のまま保持
        // 判定: currentItem.videoSourceが相対パス（./videos/始まり）ならembedded
        const isEmbedded = currentItem.videoSource?.startsWith('./videos/');
        if (isEmbedded && currentItem.startTime !== undefined) {
          adjustedTimestamp = obj.timestamp - currentItem.startTime;
        }

        return {
          ...obj,
          timestamp: adjustedTimestamp,
          target: obj.target || target,
        };
      });

      const otherObjects = currentAnn.objects.filter(
        (obj) => (obj.target || 'primary') !== target,
      );
      const mergedObjects = [...normalizedObjects, ...otherObjects];
      const newAnnotation: ItemAnnotation = {
        ...currentAnn,
        objects: mergedObjects,
        freezeDuration: Math.max(
          MIN_FREEZE_DURATION,
          currentAnn.freezeDuration ?? DEFAULT_FREEZE_DURATION,
        ),
      };
      setItemAnnotations((prev) => ({
        ...prev,
        [currentItem.id]: newAnnotation,
      }));
      setItemsWithHistory((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [currentItem, itemAnnotations, setItemsWithHistory],
  );

  const handleFreezeDurationChange = useCallback(
    (freezeDuration: number) => {
      if (!currentItem) return;
      const currentAnn = itemAnnotations[currentItem.id] || {
        objects: [],
        freezeDuration: DEFAULT_FREEZE_DURATION,
        freezeAt: 0,
      };
      const effectiveDuration =
        freezeDuration > 0
          ? Math.max(MIN_FREEZE_DURATION, freezeDuration)
          : DEFAULT_FREEZE_DURATION;
      const newAnnotation = {
        ...currentAnn,
        freezeDuration: effectiveDuration,
      };
      setItemAnnotations((prev) => ({
        ...prev,
        [currentItem.id]: newAnnotation,
      }));
      // Also update item
      setItemsWithHistory((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [currentItem, itemAnnotations, setItemsWithHistory],
  );

  // Hotkey handlers - タイムラインと完全に同じ操作感
  const playlistHotkeys: HotkeyConfig[] = useMemo(() => {
    const hotkeys: HotkeyConfig[] = [];

    // 基本操作
    hotkeys.push({
      id: 'play-pause',
      label: '再生/停止',
      key: 'Space',
      disabled: false,
    });

    // 巻き戻し
    hotkeys.push({
      id: 'skip-backward-medium',
      label: '5秒戻し',
      key: 'Left',
      disabled: false,
    });
    hotkeys.push({
      id: 'skip-backward-large',
      label: '10秒戻し',
      key: 'Shift+Left',
      disabled: false,
    });

    // 倍速再生（押下中のみ）
    hotkeys.push({
      id: 'skip-forward-small',
      label: '0.5倍速再生',
      key: 'Right',
      disabled: false,
    });
    hotkeys.push({
      id: 'skip-forward-medium',
      label: '2倍速再生',
      key: 'Shift+Right',
      disabled: false,
    });
    hotkeys.push({
      id: 'skip-forward-large',
      label: '4倍速再生',
      key: 'Command+Right',
      disabled: false,
    });
    hotkeys.push({
      id: 'skip-forward-xlarge',
      label: '6倍速再生',
      key: 'Option+Right',
      disabled: false,
    });

    // アイテム移動
    hotkeys.push({
      id: 'previous-item',
      label: '前のアイテム',
      key: 'Command+Left',
      disabled: false,
    });
    hotkeys.push({
      id: 'next-item',
      label: '次のアイテム',
      key: 'Command+Option+Right',
      disabled: false,
    });

    // 編集操作
    hotkeys.push({
      id: 'delete-item',
      label: 'アイテム削除',
      key: 'Backspace',
      disabled: false,
    });
    hotkeys.push({
      id: 'undo',
      label: '元に戻す',
      key: 'Command+Z',
      disabled: false,
    });
    hotkeys.push({
      id: 'redo',
      label: 'やり直す',
      key: 'Command+Shift+Z',
      disabled: false,
    });

    // ファイル操作
    hotkeys.push({
      id: 'save',
      label: '保存',
      key: 'Command+S',
      disabled: false,
    });
    hotkeys.push({
      id: 'export',
      label: '書き出し',
      key: 'Command+E',
      disabled: false,
    });

    // ビュー切替
    hotkeys.push({
      id: 'toggle-angle1',
      label: 'アングル1切替',
      key: 'Shift+1',
      disabled: false,
    });
    hotkeys.push({
      id: 'toggle-angle2',
      label: 'アングル2切替',
      key: 'Shift+2',
      disabled: false,
    });

    return hotkeys;
  }, []);

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

  const loadPlaylistFromPath = useCallback(async (filePath?: string) => {
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI) return;

    const loaded = await playlistAPI.loadPlaylistFile(filePath);
    if (loaded) {
      const { playlist, filePath: loadedPath } = loaded;
      console.log('[PlaylistWindow] Playlist loaded from:', loadedPath);
      setItemsWithHistory(playlist.items);
      setHasUnsavedChanges(false);
      setPlaylistName(playlist.name);
      setPlaylistType(playlist.type || 'embedded');
      setPackagePath(playlist.sourcePackagePath || null);
      setLoadedFilePath(loadedPath);
      console.log('[PlaylistWindow] loadedFilePath set to:', loadedPath);
      setIsDirty(false); // 読み込み直後はクリーン状態
      // Load annotations
      const annotations: Record<string, ItemAnnotation> = {};
      for (const item of playlist.items) {
        if (item.annotation) {
          annotations[item.id] = item.annotation;
        }
      }
      setItemAnnotations(annotations);

      const sources: string[] = [];
      if (playlist.items[0]?.videoSource) {
        sources.push(playlist.items[0].videoSource as string);
      }
      if (playlist.items[0]?.videoSource2) {
        sources.push(playlist.items[0].videoSource2 as string);
      }
      if (sources.length > 0) {
        setVideoSources(sources);
      }
      setViewMode(sources.length >= 2 ? 'dual' : 'angle1');

      // プレイリストに要素がある場合は最初のアイテムを選択
      if (playlist.items.length > 0) {
        setCurrentIndex(0);
      }
    }
  }, []);

  // Load playlist
  const handleLoadPlaylist = useCallback(async () => {
    handleMenuClose();
    await loadPlaylistFromPath();
  }, [loadPlaylistFromPath]);

  useEffect(() => {
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI?.onExternalOpen) return;
    const unsub = playlistAPI.onExternalOpen((filePath: string) => {
      loadPlaylistFromPath(filePath);
    });
    return () => {
      unsub?.();
    };
  }, [loadPlaylistFromPath]);

  // ウィンドウクローズ時の保存要求を処理
  useEffect(() => {
    const handleRequestSave = () => {
      if (loadedFilePath) {
        // 既存ファイルがあれば即上書き保存し、保存後に閉じる
        handleSavePlaylist(true);
      } else {
        // 新規ファイルの場合は保存ダイアログを表示
        setCloseAfterSave(true);
        setSaveDialogOpen(true);
      }
    };

    window.electronAPI?.on?.('playlist:request-save', handleRequestSave);

    return () => {
      window.electronAPI?.off?.('playlist:request-save', handleRequestSave);
    };
  }, [loadedFilePath, handleSavePlaylist]);

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
        onControlsVisibleChange={setControlsVisible}
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
