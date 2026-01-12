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
import { useTheme } from '@mui/material/styles';

const DEFAULT_FREEZE_DURATION = 3; // seconds - Sportscode風の自動停止既定値を少し延長
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
  const theme = useTheme();
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
  const [controlsVisible, setControlsVisible] = useState(true);

  // Freeze frame state
  const [isFrozen, setIsFrozen] = useState(false);

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
  const [isExporting, setIsExporting] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showQualifier: true,
  });
  const [exportMode, setExportMode] = useState<
    'single' | 'perInstance' | 'perRow'
  >('single');
  const [angleOption, setAngleOption] = useState<'all' | 'angle1' | 'angle2'>(
    'all',
  );
  const [exportFileName, setExportFileName] = useState('');

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

  // Get video source for current item (secondary - for dual view)
  const currentVideoSource2 = useMemo(() => {
    if (!currentItem || !isDualView) return null;
    return currentItem.videoSource2 || videoSources[1] || null;
  }, [currentItem, isDualView, videoSources]);

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
    if (!isDualView || !currentVideoSource2) {
      setDrawingTarget('primary');
    }
  }, [isDualView, currentVideoSource2]);

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
  }, [currentVideoSource]);

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
  }, [currentVideoSource2, isDualView]);

  // Auto-hide controls overlay like main player
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hideTimer: NodeJS.Timeout | null = null;
    const show = () => {
      setControlsVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isDrawingMode && isPlaying) {
          setControlsVisible(false);
        }
      }, 1800);
    };

    show();
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
      setPackagePath(data.packagePath || null);

      // アイテム側にソースが付いている場合はそれを優先し、グローバルなvideoSourcesで上書きしない
      const hasItemSources =
        activePlaylist?.items?.some(
          (it) => !!it.videoSource || !!it.videoSource2,
        ) ?? false;
      if (!hasItemSources) {
        setVideoSources(data.videoSources || []);
        if (data.videoSources && data.videoSources.length >= 2) {
          setIsDualView(true);
        }
      } else {
        // アイテム別ソースがある場合は、現在のアイテムの有無でデュアル判定
        const current = activePlaylist?.items.find(
          (it) => it.id === data.state.playingItemId,
        );
        setIsDualView(
          !!(
            current?.videoSource2 ||
            activePlaylist?.items.some((it) => !!it.videoSource2)
          ),
        );
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
      lastFreezeTimestampRef.current = null;
      setIsFrozen(false);
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
          freezeDuration: currentAnn.freezeDuration ?? DEFAULT_FREEZE_DURATION,
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

      const savedPath = await playlistAPI.savePlaylistFile(playlist);
      if (savedPath) {
        console.log('[PlaylistWindow] Playlist saved to:', savedPath);
        setPlaylistName(name);
      }
    },
    [items, videoSources, packagePath, itemAnnotations],
  );

  const loadPlaylistFromPath = useCallback(async (filePath?: string) => {
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI) return;

    const loaded = await playlistAPI.loadPlaylistFile(filePath);
    if (loaded) {
      const { playlist } = loaded;
      setItems(playlist.items);
      setPlaylistName(playlist.name);
      setPackagePath(playlist.sourcePackagePath || null);
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
      setIsDualView(sources.length >= 2);
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

  const handleExportPlaylist = useCallback(async () => {
    const api = window.electronAPI?.exportClipsWithOverlay;
    if (!api) {
      alert('書き出しAPIが利用できません');
      return;
    }
    const sourcePath = videoSources[0];
    if (!sourcePath) {
      alert('メイン映像が取得できません');
      return;
    }
    const sourcePath2 = videoSources[1];
    const useDual =
      angleOption === 'all' && sourcePath2 ? true : angleOption === 'angle2';
    if (useDual && !sourcePath2) {
      alert('2アングルの書き出しには2つの映像ソースが必要です');
      return;
    }

    const ordered = [...items];
    const actionIndexLookup = new Map<string, number>();
    const counters: Record<string, number> = {};
    ordered.forEach((item) => {
      const c = (counters[item.actionName] || 0) + 1;
      counters[item.actionName] = c;
      actionIndexLookup.set(item.id, c);
    });

    const clips = ordered.map((item) => {
      const annotation = itemAnnotations[item.id] || item.annotation;
      const allTimestamps =
        annotation?.objects
          ?.map((o) => o.timestamp)
          .filter((t) => t !== undefined) || [];
      const freezeAtAbsolute =
        allTimestamps.length > 0 ? Math.min(...allTimestamps) : null;
      const freezeAt =
        freezeAtAbsolute !== null
          ? Math.max(0, freezeAtAbsolute - item.startTime)
          : null;
      const freezeDuration =
        annotation?.freezeDuration && annotation.freezeDuration > 0
          ? Math.max(MIN_FREEZE_DURATION, annotation.freezeDuration)
          : MIN_FREEZE_DURATION;
      const annPrimary = renderAnnotationPng(
        annotation?.objects,
        'primary',
        primaryContentRect,
        primarySourceSize,
      );
      const annSecondary = renderAnnotationPng(
        annotation?.objects,
        'secondary',
        secondaryContentRect,
        secondarySourceSize,
      );
      return {
        id: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        freezeAt,
        freezeDuration,
        labels:
          item.labels?.map((l) => ({ group: l.group || '', name: l.name })) ||
          undefined,
        qualifier: item.qualifier || undefined,
        actionIndex: actionIndexLookup.get(item.id) ?? 1,
        annotationPngPrimary: annPrimary,
        annotationPngSecondary: annSecondary,
      };
    });

    setIsExporting(true);
    const result = await api({
      sourcePath,
      sourcePath2: useDual ? sourcePath2 : undefined,
      mode: useDual ? 'dual' : 'single',
      exportMode,
      angleOption: useDual ? angleOption : 'angle1',
      outputFileName: exportFileName.trim() || undefined,
      clips,
      overlay: overlaySettings,
    });
    setIsExporting(false);
    if (result?.success) {
      alert('プレイリストを書き出しました');
      setExportDialogOpen(false);
    } else {
      alert(result?.error || '書き出しに失敗しました');
    }
  }, [
    angleOption,
    exportFileName,
    exportMode,
    items,
    itemAnnotations,
    overlaySettings,
    primaryContentRect,
    renderAnnotationPng,
    secondaryContentRect,
    videoSources,
  ]);

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
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: theme.palette.background.paper,
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid',
          borderColor: theme.palette.divider,
          px: 1.5,
          py: 0.75,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlaylistPlay sx={{ color: theme.palette.primary.main }} />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {playlistName}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="primary"
            sx={{ textTransform: 'none' }}
            onClick={() => setExportDialogOpen(true)}
            disabled={isExporting}
          >
            書き出し
          </Button>
          <Badge badgeContent={items.length} color="secondary" max={99}>
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
            {isDrawingMode && isDualView && currentVideoSource2 && (
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
                width={primaryCanvasSize.width}
                height={primaryCanvasSize.height}
                isActive={isDrawingMode && drawingTarget === 'primary'}
                target="primary"
                initialObjects={primaryAnnotationObjects}
                freezeDuration={
                  currentAnnotation?.freezeDuration ?? DEFAULT_FREEZE_DURATION
                }
                contentRect={primaryContentRect}
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
                  width={secondaryCanvasSize.width}
                  height={secondaryCanvasSize.height}
                  isActive={isDrawingMode && drawingTarget === 'secondary'}
                  target="secondary"
                  initialObjects={secondaryAnnotationObjects}
                  freezeDuration={
                    currentAnnotation?.freezeDuration ?? DEFAULT_FREEZE_DURATION
                  }
                  contentRect={secondaryContentRect}
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
              bgcolor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              opacity: controlsVisible ? 1 : 0,
              transition: 'opacity 0.35s ease',
              pointerEvents: controlsVisible ? 'auto' : 'none',
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
          bgcolor: theme.palette.background.paper,
          px: 1,
          py: 0.5,
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: theme.palette.divider,
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
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
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
            bgcolor: theme.palette.background.paper,
            px: 1.5,
            py: 0.75,
            borderTop: '1px solid',
            borderColor: theme.palette.divider,
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
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>プレイリストを書き出し</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
          <TextField
            label="ファイル名 (拡張子不要)"
            fullWidth
            size="small"
            value={exportFileName}
            onChange={(e) => setExportFileName(e.target.value)}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">出力モード</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={exportMode}
              onChange={(_, v) => v && setExportMode(v)}
            >
              <ToggleButton value="single">1ファイル</ToggleButton>
              <ToggleButton value="perInstance">インスタンスごと</ToggleButton>
              <ToggleButton value="perRow">アクションごと</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">映像</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={angleOption}
              onChange={(_, v) => v && setAngleOption(v)}
            >
              <ToggleButton value="angle1">メインのみ</ToggleButton>
              <ToggleButton value="angle2" disabled={!videoSources[0]}>
                メイン切替
              </ToggleButton>
              <ToggleButton value="all" disabled={!videoSources[1]}>
                デュアル結合
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="body2">オーバーレイ</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={overlaySettings.enabled ? 'on' : 'off'}
              onChange={(_, v) =>
                setOverlaySettings((prev) => ({ ...prev, enabled: v === 'on' }))
              }
            >
              <ToggleButton value="on">表示</ToggleButton>
              <ToggleButton value="off">非表示</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant={
                  overlaySettings.showActionName ? 'contained' : 'outlined'
                }
                onClick={() =>
                  setOverlaySettings((p) => ({
                    ...p,
                    showActionName: !p.showActionName,
                  }))
                }
              >
                アクション名
              </Button>
              <Button
                size="small"
                variant={
                  overlaySettings.showActionIndex ? 'contained' : 'outlined'
                }
                onClick={() =>
                  setOverlaySettings((p) => ({
                    ...p,
                    showActionIndex: !p.showActionIndex,
                  }))
                }
              >
                通番
              </Button>
              <Button
                size="small"
                variant={overlaySettings.showLabels ? 'contained' : 'outlined'}
                onClick={() =>
                  setOverlaySettings((p) => ({
                    ...p,
                    showLabels: !p.showLabels,
                  }))
                }
              >
                ラベル
              </Button>
              <Button
                size="small"
                variant={
                  overlaySettings.showQualifier ? 'contained' : 'outlined'
                }
                onClick={() =>
                  setOverlaySettings((p) => ({
                    ...p,
                    showQualifier: !p.showQualifier,
                  }))
                }
              >
                Qualifier
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              形式: 1行目=通番+アクション名（太字）、2行目=ラベル、3行目=メモ
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleExportPlaylist}
            variant="contained"
            disabled={isExporting}
          >
            {isExporting ? '書き出し中...' : '書き出す'}
          </Button>
        </DialogActions>
      </Dialog>
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
