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
import {
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Divider,
  Slider,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  ListItemIcon,
  alpha,
  Badge,
} from '@mui/material';
import {
  Delete,
  DragIndicator,
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  MoreVert,
  Loop,
  PlaylistPlay,
  Save,
  FolderOpen,
  Edit,
  Brush,
  Link,
  LinkOff,
  Comment,
  Notes,
  ContentCopy,
  PauseCircle,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  PlaylistItem,
  PlaylistSyncData,
  PlaylistType,
  DrawingObject,
  ItemAnnotation,
  AnnotationTarget,
} from '../../types/Playlist';
import AnnotationCanvas, {
  AnnotationCanvasRef,
} from './components/AnnotationCanvas';

const DEFAULT_FREEZE_DURATION = 2; // seconds - Sportscode風の自動停止既定値
const MIN_FREEZE_DURATION = 1; // seconds - ユーザー要求の最低停止秒数
const ANNOTATION_TIME_TOLERANCE = 0.12; // 秒: 描画タイミング判定のゆらぎ
const FREEZE_RETRIGGER_GUARD = 0.3; // 秒: 同じタイミングでの連続フリーズ防止

// ===== Sortable Item Component =====
interface SortableItemProps {
  item: PlaylistItem;
  index: number;
  isActive: boolean;
  onRemove: (id: string) => void;
  onPlay: (id: string) => void;
  onEditNote: (id: string) => void;
}

function SortableItem({
  item,
  index,
  isActive,
  onRemove,
  onPlay,
  onEditNote,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = item.endTime - item.startTime;
  const hasAnnotation =
    item.annotation &&
    (item.annotation.objects.length > 0 || item.annotation.freezeDuration > 0);

  return (
    <ListItemButton
      ref={setNodeRef}
      style={style}
      selected={isActive}
      onClick={() => onPlay(item.id)}
      sx={{
        py: 0.5,
        px: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: isActive ? alpha('#1976d2', 0.15) : 'transparent',
        '&:hover': {
          bgcolor: isActive ? alpha('#1976d2', 0.2) : alpha('#fff', 0.05),
        },
        '&.Mui-selected': {
          bgcolor: alpha('#1976d2', 0.15),
        },
      }}
    >
      {/* Index number */}
      <Typography
        variant="caption"
        sx={{
          width: 24,
          textAlign: 'center',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? 'primary.main' : 'text.secondary',
        }}
      >
        {index + 1}
      </Typography>

      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          mx: 0.5,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        <DragIndicator fontSize="small" />
      </Box>

      {/* Content */}
      <ListItemText
        primary={
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'primary.main' : 'text.primary',
                maxWidth: 150,
              }}
            >
              {item.actionName}
            </Typography>
            {item.note && (
              <Tooltip title={item.note}>
                <Comment
                  fontSize="small"
                  sx={{ fontSize: 14, color: 'warning.main' }}
                />
              </Tooltip>
            )}
            {hasAnnotation && (
              <Tooltip
                title={`描画あり${item.annotation?.freezeDuration ? ` (${item.annotation.freezeDuration}秒停止)` : ''}`}
              >
                <Brush
                  fontSize="small"
                  sx={{ fontSize: 14, color: 'info.main' }}
                />
              </Tooltip>
            )}
          </Stack>
        }
        secondary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
            >
              {formatTime(item.startTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ({formatTime(duration)})
            </Typography>
            {item.annotation?.freezeDuration ? (
              <PauseCircle
                sx={{ fontSize: 12, color: 'warning.main', ml: 0.5 }}
              />
            ) : null}
          </Stack>
        }
        sx={{ my: 0 }}
      />

      {/* Actions */}
      <ListItemSecondaryAction>
        <Stack direction="row" spacing={0}>
          <Tooltip title="メモを編集">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEditNote(item.id);
              }}
            >
              <Edit fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
            >
              <Delete fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </ListItemSecondaryAction>
    </ListItemButton>
  );
}

// ===== Save Dialog Component =====
interface SaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (type: PlaylistType, name: string) => void;
  defaultName: string;
}

function SaveDialog({ open, onClose, onSave, defaultName }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const [saveType, setSaveType] = useState<PlaylistType>('embedded');

  useEffect(() => {
    setName(defaultName);
  }, [defaultName, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>プレイリストを保存</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="プレイリスト名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
          />
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              保存形式
            </Typography>
            <ToggleButtonGroup
              value={saveType}
              exclusive
              onChange={(_, value) => value && setSaveType(value)}
              fullWidth
              size="small"
            >
              <ToggleButton value="embedded">
                <Stack direction="row" spacing={1} alignItems="center">
                  <LinkOff fontSize="small" />
                  <Box textAlign="left">
                    <Typography variant="caption" display="block">
                      スタンドアロン
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      独立したファイル
                    </Typography>
                  </Box>
                </Stack>
              </ToggleButton>
              <ToggleButton value="reference">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Link fontSize="small" />
                  <Box textAlign="left">
                    <Typography variant="caption" display="block">
                      参照
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      元データにリンク
                    </Typography>
                  </Box>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {saveType === 'embedded'
              ? 'スタンドアロン: 動画パスと描画データを含めて保存'
              : '参照: 元のタイムラインへのリンクを維持'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={() => onSave(saveType, name)}
          variant="contained"
          disabled={!name.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ===== Note Edit Dialog =====
interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote: string;
  itemName: string;
}

function NoteDialog({
  open,
  onClose,
  onSave,
  initialNote,
  itemName,
}: NoteDialogProps) {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Notes />
          <Typography>メモを編集: {itemName}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <TextField
          multiline
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          fullWidth
          placeholder="アイテムに関するメモを入力..."
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(note)} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ===== Main Component =====
export default function PlaylistWindowApp() {
  // State
  const [items, setItems] = useState<PlaylistItem[]>([]);
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
  const [isDualView, setIsDualView] = useState(false);
  const [playlistName, setPlaylistName] = useState('プレイリスト');
  const [packagePath, setPackagePath] = useState<string | null>(null);

  // Drawing/Annotation state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [itemAnnotations, setItemAnnotations] = useState<
    Record<string, ItemAnnotation>
  >({});
  const [drawingTarget, setDrawingTarget] =
    useState<AnnotationTarget>('primary');

  // Freeze frame state
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeTimeoutId, setFreezeTimeoutId] = useState<NodeJS.Timeout | null>(
    null,
  );

  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationCanvasRefPrimary = useRef<AnnotationCanvasRef>(null);
  const annotationCanvasRefSecondary = useRef<AnnotationCanvasRef>(null);
  const lastFreezeTimestampRef = useRef<number | null>(null);

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
    return videoSources[0] || null;
  }, [currentItem, videoSources]);

  // Get video source for current item (secondary - for dual view)
  const currentVideoSource2 = useMemo(() => {
    if (!currentItem || !isDualView) return null;
    return videoSources[1] || null;
  }, [currentItem, isDualView, videoSources]);

  useEffect(() => {
    if (!isDualView || !currentVideoSource2) {
      setDrawingTarget('primary');
    }
  }, [isDualView, currentVideoSource2]);

  useEffect(() => {
    lastFreezeTimestampRef.current = null;
  }, [currentItem?.id]);

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
    return { objects: [], freezeDuration: DEFAULT_FREEZE_DURATION, freezeAt: 0 };
  }, [currentItem, itemAnnotations]);

  const annotationObjects = currentAnnotation?.objects || [];
  const primaryAnnotationObjects = useMemo(
    () =>
      annotationObjects.filter(
        (obj) => (obj.target || 'primary') === 'primary',
      ),
    [annotationObjects],
  );
  const secondaryAnnotationObjects = useMemo(
    () =>
      annotationObjects.filter(
        (obj) => (obj.target || 'primary') === 'secondary',
      ),
    [annotationObjects],
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
        setItems(activePlaylist.items);
        setPlaylistName(activePlaylist.name);
        // Load annotations from items
        const annotations: Record<string, ItemAnnotation> = {};
        for (const item of activePlaylist.items) {
          if (item.annotation) {
            annotations[item.id] = item.annotation;
          }
        }
        setItemAnnotations(annotations);
      }
      setVideoSources(data.videoSources || []);
      setPackagePath(data.packagePath || null);
      if (data.videoSources && data.videoSources.length >= 2) {
        setIsDualView(true);
      }
    };

    if (playlistAPI) {
      playlistAPI.onSync(handlePlaylistSync);
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

      // Resume after freeze duration
      const timeoutId = setTimeout(() => {
        setIsFrozen(false);
        if (isPlaying) {
          video?.play().catch(console.error);
          video2?.play().catch(console.error);
        }
      }, duration * 1000);

      setFreezeTimeoutId(timeoutId);
    },
    [isFrozen, isPlaying],
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

  // Cleanup freeze timeout
  useEffect(() => {
    return () => {
      if (freezeTimeoutId) {
        clearTimeout(freezeTimeoutId);
      }
    };
  }, [freezeTimeoutId]);

  const handleItemEnd = useCallback(() => {
    // Clear any freeze state
    if (freezeTimeoutId) {
      clearTimeout(freezeTimeoutId);
      setFreezeTimeoutId(null);
    }
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
  }, [autoAdvance, currentIndex, items.length, loopPlaylist, freezeTimeoutId]);

  // Play/pause handling for both videos
  useEffect(() => {
    const video = videoRef.current;
    const video2 = videoRef2.current;
    if (!video || !currentVideoSource) return;

    if (isPlaying && !isFrozen) {
      video.play().catch(console.error);
      if (video2 && currentVideoSource2) {
        video2.play().catch(console.error);
      }
    } else {
      video.pause();
      if (video2) {
        video2.pause();
      }
    }
  }, [isPlaying, isFrozen, currentVideoSource, currentVideoSource2]);

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
    if (freezeTimeoutId) {
      clearTimeout(freezeTimeoutId);
      setFreezeTimeoutId(null);
    }
    lastFreezeTimestampRef.current = null;
    setIsFrozen(false);

    video.src = currentVideoSource;
    video.load();
    video.currentTime = currentItem.startTime;

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
  }, [currentVideoSource2, currentItem?.id, isPlaying, isFrozen]);

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
      if (freezeTimeoutId) {
        clearTimeout(freezeTimeoutId);
        setFreezeTimeoutId(null);
      }
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
  }, [currentIndex, items.length, isPlaying, isFrozen, freezeTimeoutId]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(items.length - 1);
    }
  }, [currentIndex, loopPlaylist, items.length]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (loopPlaylist && items.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, items.length, loopPlaylist]);

  const handleRemoveItem = useCallback(
    (id: string) => {
      setItems((prev) => {
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
    },
    [currentIndex],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setItems((prev) => {
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
    },
    [currentIndex],
  );

  const handleSeek = useCallback(
    (_: Event, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value;
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      if (videoRef2.current && isDualView) {
        videoRef2.current.currentTime = time;
      }
    },
    [isDualView],
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
        ref: React.RefObject<AnnotationCanvasRef>,
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
          freezeDuration:
            currentAnn.freezeDuration ?? DEFAULT_FREEZE_DURATION,
        };
        setItemAnnotations((prev) => ({
          ...prev,
          [currentItem.id]: newAnnotation,
        }));
        setItems((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, annotation: newAnnotation }
              : item,
          ),
        );
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
      const normalizedObjects = objects.map((obj) => ({
        ...obj,
        target: obj.target || target,
      }));
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
    },
    [currentItem, itemAnnotations],
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
    },
    [currentItem, itemAnnotations],
  );

  // Save playlist
  const handleSavePlaylist = useCallback(
    async (type: PlaylistType, name: string) => {
      setSaveDialogOpen(false);
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) return;

      // Merge annotations into items
      const itemsWithAnnotations = items.map((item) => ({
        ...item,
        videoSource: type === 'embedded' ? videoSources[0] : undefined,
        videoSource2: type === 'embedded' ? videoSources[1] : undefined,
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

      const savedPath = await playlistAPI.savePlaylistFile(playlist);
      if (savedPath) {
        console.log('[PlaylistWindow] Playlist saved to:', savedPath);
        setPlaylistName(name);
      }
    },
    [items, videoSources, packagePath, itemAnnotations],
  );

  // Load playlist
  const handleLoadPlaylist = useCallback(async () => {
    handleMenuClose();
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI) return;

    const loaded = await playlistAPI.loadPlaylistFile();
    if (loaded) {
      setItems(loaded.items);
      setPlaylistName(loaded.name);
      // Load annotations
      const annotations: Record<string, ItemAnnotation> = {};
      for (const item of loaded.items) {
        if (item.annotation) {
          annotations[item.id] = item.annotation;
        }
      }
      setItemAnnotations(annotations);

      const sources: string[] = [];
      if (loaded.items[0]?.videoSource) {
        sources.push(loaded.items[0].videoSource);
      }
      if (loaded.items[0]?.videoSource2) {
        sources.push(loaded.items[0].videoSource2);
      }
      if (sources.length > 0) {
        setVideoSources(sources);
      }
      if (sources.length >= 2) {
        setIsDualView(true);
      }
    }
  }, []);

  // Edit note
  const handleEditNote = useCallback((itemId: string) => {
    setEditingItemId(itemId);
    setNoteDialogOpen(true);
  }, []);

  const handleSaveNote = useCallback(
    (note: string) => {
      if (!editingItemId) return;
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId ? { ...item, note } : item,
        ),
      );
      setNoteDialogOpen(false);
      setEditingItemId(null);
    },
    [editingItemId],
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
        bgcolor: '#1a1a2e',
        color: '#fff',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#16213e',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 1.5,
          py: 0.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlaylistPlay sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {playlistName}
          </Typography>
          <Badge badgeContent={items.length} color="primary" max={99}>
            <Typography variant="caption" color="text.secondary">
              アイテム
            </Typography>
          </Badge>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVert fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem
              onClick={() => {
                handleMenuClose();
                setSaveDialogOpen(true);
              }}
            >
              <ListItemIcon>
                <Save fontSize="small" />
              </ListItemIcon>
              プレイリストを保存
            </MenuItem>
            <MenuItem onClick={handleLoadPlaylist}>
              <ListItemIcon>
                <FolderOpen fontSize="small" />
              </ListItemIcon>
              プレイリストを開く
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                handleMenuClose();
                setIsDualView(!isDualView);
              }}
              disabled={videoSources.length < 2}
            >
              <ListItemIcon>
                <ContentCopy fontSize="small" />
              </ListItemIcon>
              {isDualView ? 'シングルビュー' : 'デュアルビュー'}
            </MenuItem>
          </Menu>
        </Stack>
      </Paper>

      {/* Video Player Area */}
      <Box
        sx={{
          flex: '0 0 auto',
          height: '50%',
          minHeight: 250,
          bgcolor: '#000',
          position: 'relative',
          display: 'flex',
        }}
      >
        {currentVideoSource ? (
          <>
            {isDualView && currentVideoSource2 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 6,
                }}
              >
                <Paper
                  sx={{
                    px: 1,
                    py: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                  }}
                  elevation={3}
                >
                  <Typography variant="caption" sx={{ color: 'grey.200' }}>
                    描画対象
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={drawingTarget}
                    onChange={(_, value) =>
                      value && setDrawingTarget(value as AnnotationTarget)
                    }
                  >
                    <ToggleButton value="primary">メイン</ToggleButton>
                    <ToggleButton
                      value="secondary"
                      disabled={!currentVideoSource2}
                    >
                      サブ
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Paper>
              </Box>
            )}
            {/* Primary Video */}
            <Box
              sx={{
                flex: isDualView && currentVideoSource2 ? '0 0 50%' : '1',
                height: '100%',
                position: 'relative',
              }}
            >
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
              {/* Annotation Canvas Overlay */}
              <AnnotationCanvas
                ref={annotationCanvasRefPrimary}
                width={1920}
                height={1080}
                isActive={isDrawingMode && drawingTarget === 'primary'}
                target="primary"
                initialObjects={primaryAnnotationObjects}
                freezeDuration={
                  currentAnnotation?.freezeDuration ?? DEFAULT_FREEZE_DURATION
                }
                onObjectsChange={(objs) =>
                  handleAnnotationObjectsChange(objs, 'primary')
                }
                onFreezeDurationChange={handleFreezeDurationChange}
                currentTime={currentTime}
              />
              {/* Freeze Indicator */}
              {isFrozen && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <PauseCircle fontSize="small" />
                  <Typography variant="caption">停止中</Typography>
                </Box>
              )}
            </Box>
            {/* Secondary Video (Dual View) */}
            {isDualView && currentVideoSource2 && (
              <Box
                sx={{
                  flex: '0 0 50%',
                  height: '100%',
                  position: 'relative',
                  borderLeft: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                  <video
                    ref={videoRef2}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                  <AnnotationCanvas
                    ref={annotationCanvasRefSecondary}
                    width={1920}
                    height={1080}
                    isActive={
                      isDrawingMode && drawingTarget === 'secondary'
                    }
                    target="secondary"
                    initialObjects={secondaryAnnotationObjects}
                    freezeDuration={
                      currentAnnotation?.freezeDuration ?? DEFAULT_FREEZE_DURATION
                    }
                    onObjectsChange={(objs) =>
                      handleAnnotationObjectsChange(objs, 'secondary')
                    }
                    onFreezeDurationChange={handleFreezeDurationChange}
                    currentTime={currentTime}
                  />
              </Box>
            )}
          </>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <PlaylistPlay sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary">
              {items.length === 0
                ? 'プレイリストが空です'
                : 'ビデオソースが設定されていません'}
            </Typography>
          </Box>
        )}

        {/* Video Controls Overlay */}
        {currentItem && !isDrawingMode && (
          <Paper
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Slider
              size="small"
              value={currentTime}
              min={sliderMin}
              max={sliderMax}
              onChange={handleSeek}
              sx={{
                mb: 0.5,
                '& .MuiSlider-thumb': { width: 12, height: 12 },
                '& .MuiSlider-track': { bgcolor: 'primary.main' },
              }}
              marks={
                currentAnnotation?.objects?.length
                  ? currentAnnotation.objects.map((obj) => ({
                      value: obj.timestamp,
                      label: '',
                    }))
                  : []
              }
            />
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography
                variant="caption"
                sx={{ minWidth: 80, fontFamily: 'monospace' }}
              >
                {formatTime(currentTime - sliderMin)} /{' '}
                {formatTime(sliderMax - sliderMin)}
              </Typography>

              <IconButton size="small" onClick={handlePrevious}>
                <SkipPrevious fontSize="small" />
              </IconButton>
              <IconButton onClick={handleTogglePlay} color="primary">
                {isPlaying && !isFrozen ? <Pause /> : <PlayArrow />}
              </IconButton>
              <IconButton size="small" onClick={handleNext}>
                <SkipNext fontSize="small" />
              </IconButton>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 0.5, bgcolor: 'grey.700' }}
              />

              <Tooltip title={autoAdvance ? '連続再生: ON' : '連続再生: OFF'}>
                <IconButton
                  size="small"
                  onClick={() => setAutoAdvance(!autoAdvance)}
                  color={autoAdvance ? 'primary' : 'default'}
                >
                  <PlaylistPlay fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={loopPlaylist ? 'ループ: ON' : 'ループ: OFF'}>
                <IconButton
                  size="small"
                  onClick={() => setLoopPlaylist(!loopPlaylist)}
                  color={loopPlaylist ? 'primary' : 'default'}
                >
                  <Loop fontSize="small" />
                </IconButton>
              </Tooltip>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 0.5, bgcolor: 'grey.700' }}
              />

              <Tooltip
                title={
                  isDrawingMode ? '描画モード: ON' : '描画（図形・テキスト）'
                }
              >
                <IconButton
                  size="small"
                  onClick={handleToggleDrawingMode}
                  color={isDrawingMode ? 'warning' : 'default'}
                >
                  <Brush fontSize="small" />
                </IconButton>
              </Tooltip>

              <Box sx={{ flex: 1 }} />

              <IconButton size="small" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? (
                  <VolumeOff fontSize="small" />
                ) : (
                  <VolumeUp fontSize="small" />
                )}
              </IconButton>
              <Slider
                size="small"
                value={volume}
                min={0}
                max={1}
                step={0.1}
                onChange={handleVolumeChange}
                sx={{ width: 60 }}
              />
              <IconButton size="small" onClick={handleToggleFullscreen}>
                {isFullscreen ? (
                  <FullscreenExit fontSize="small" />
                ) : (
                  <Fullscreen fontSize="small" />
                )}
              </IconButton>
            </Stack>
          </Paper>
        )}

        {/* Drawing mode controls (exit button) */}
        {isDrawingMode && (
          <Paper
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.9)',
            }}
          >
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={handleToggleDrawingMode}
              startIcon={<Brush />}
            >
              描画を終了
            </Button>
          </Paper>
        )}
      </Box>

      {/* Playlist Header */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#16213e',
          px: 1,
          py: 0.5,
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center">
          <Typography
            variant="caption"
            sx={{ width: 24, textAlign: 'center', color: 'text.secondary' }}
          >
            #
          </Typography>
          <Typography
            variant="caption"
            sx={{ flex: 1, ml: 3, color: 'text.secondary' }}
          >
            アクション
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            時間
          </Typography>
        </Stack>
      </Paper>

      {/* Playlist Items */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#0f0f1a' }}>
        {items.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
            }}
          >
            <Typography color="text.secondary" textAlign="center">
              プレイリストが空です。
              <br />
              タイムライン上でアクションを右クリックして
              <br />
              「プレイリストに追加」を選択してください。
            </Typography>
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <List disablePadding>
                {items.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    isActive={index === currentIndex}
                    onRemove={handleRemoveItem}
                    onPlay={(id) => handlePlayItem(id)}
                    onEditNote={handleEditNote}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        )}
      </Box>

      {/* Now Playing Info */}
      {currentItem && (
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#16213e',
            px: 1.5,
            py: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {isFrozen ? (
              <PauseCircle fontSize="small" color="warning" />
            ) : (
              <PlayArrow fontSize="small" color="primary" />
            )}
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {currentItem.actionName}
              {currentItem.note && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  - {currentItem.note}
                </Typography>
              )}
            </Typography>
            {currentAnnotation?.objects.length ? (
              <Tooltip title={`描画 ${currentAnnotation.objects.length}個`}>
                <Brush fontSize="small" sx={{ color: 'info.main' }} />
              </Tooltip>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {currentIndex + 1} / {items.length}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Dialogs */}
      <SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSavePlaylist}
        defaultName={playlistName}
      />
      <NoteDialog
        open={noteDialogOpen}
        onClose={() => {
          setNoteDialogOpen(false);
          setEditingItemId(null);
        }}
        onSave={handleSaveNote}
        initialNote={editingItem?.note || ''}
        itemName={editingItem?.actionName || ''}
      />
    </Box>
  );
}
