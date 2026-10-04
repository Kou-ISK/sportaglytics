import { useCallback, useRef, useState } from 'react';
import type {
  AnnotationTarget,
  ItemAnnotation,
  PlaylistRow,
  PlaylistType,
} from '../../../../types/playlist/core';
import type { AnnotationCanvasRef } from '../../components/AnnotationCanvas';
import type { PlaylistWorkspaceMode } from '../../../../types/playlist/window';
import { usePlaylistSaveDialogState } from './usePlaylistSaveDialogState';
import { PlaylistLoadQueue } from './PlaylistLoadQueue';

export const usePlaylistWindowCoreState = () => {
  const loadQueueRef = useRef<PlaylistLoadQueue | null>(null);
  if (!loadQueueRef.current) loadQueueRef.current = new PlaylistLoadQueue();
  const loadQueue = loadQueueRef.current;
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false);
  const setHasUnsavedChanges = useCallback(
    (update: React.SetStateAction<boolean>): void => {
      // Track repeated edits even when the document was already dirty.
      if (update !== false) loadQueue.markEdited();
      setHasUnsavedChangesState(update);
    },
    [loadQueue],
  );
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
  const [viewMode, setViewMode] = useState<'dual' | 'angle1' | 'angle2'>(
    'dual',
  );
  const [playlistName, setPlaylistName] = useState('プレイリスト');
  const [playlistType, setPlaylistType] = useState<PlaylistType>('embedded');
  const [playlistRows, setPlaylistRowsState] = useState<PlaylistRow[]>([]);
  const playlistRowsRef = useRef(playlistRows);
  const setPlaylistRows = useCallback(
    (update: React.SetStateAction<PlaylistRow[]>): void => {
      playlistRowsRef.current =
        typeof update === 'function' ? update(playlistRowsRef.current) : update;
      setPlaylistRowsState(playlistRowsRef.current);
    },
    [],
  );
  const getPlaylistRows = useCallback(
    (): PlaylistRow[] => playlistRowsRef.current,
    [],
  );
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
  // Window-only state: these values never participate in Playlist dirty state.
  const [workspaceMode, setWorkspaceMode] =
    useState<PlaylistWorkspaceMode>('organizer');
  const [workspaceRatio, setWorkspaceRatio] = useState(0.5);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [inspectorWidth, setInspectorWidth] = useState(280);

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

  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null);

  return {
    loadQueue,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isFullscreen,
    setIsFullscreen,
    loopPlaylist,
    setLoopPlaylist,
    autoAdvance,
    setAutoAdvance,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    videoSources,
    setVideoSources,
    viewMode,
    setViewMode,
    playlistName,
    setPlaylistName,
    playlistType,
    setPlaylistType,
    playlistRows,
    setPlaylistRows,
    getPlaylistRows,
    packagePath,
    setPackagePath,
    isDrawingMode,
    setIsDrawingMode,
    itemAnnotations,
    setItemAnnotations,
    drawingTarget,
    setDrawingTarget,
    controlsVisible,
    setControlsVisible,
    isVideoAreaHovered,
    setIsVideoAreaHovered,
    videoAreaInteractionId,
    setVideoAreaInteractionId,
    isFrozen,
    setIsFrozen,
    workspaceMode,
    setWorkspaceMode,
    workspaceRatio,
    setWorkspaceRatio,
    inspectorVisible,
    setInspectorVisible,
    inspectorWidth,
    setInspectorWidth,
    saveDialogOpen,
    setSaveDialogOpen,
    closeAfterSave,
    setCloseAfterSave,
    videoRef,
    videoRef2,
    containerRef,
    annotationCanvasRefPrimary,
    annotationCanvasRefSecondary,
    primaryCanvasSize,
    setPrimaryCanvasSize,
    secondaryCanvasSize,
    setSecondaryCanvasSize,
    primaryContentRect,
    setPrimaryContentRect,
    secondaryContentRect,
    setSecondaryContentRect,
    primarySourceSize,
    setPrimarySourceSize,
    secondarySourceSize,
    setSecondarySourceSize,
    saveProgress,
    setSaveProgress,
    isDirty,
    setIsDirty,
    loadedFilePath,
    setLoadedFilePath,
  };
};
