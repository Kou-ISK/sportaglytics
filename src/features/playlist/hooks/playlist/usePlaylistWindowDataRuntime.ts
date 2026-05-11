import {
  DEFAULT_FREEZE_DURATION,
  MIN_FREEZE_DURATION,
} from './playlistWindowController.constants';
import { usePlaylistAnnotations } from './usePlaylistAnnotations';
import { usePlaylistCurrentItem } from './usePlaylistCurrentItem';
import { usePlaylistDndSensors } from './usePlaylistDndSensors';
import { usePlaylistExportState } from './usePlaylistExportState';
import { usePlaylistHistory } from './usePlaylistHistory';
import { usePlaylistHistorySync } from './usePlaylistHistorySync';
import { usePlaylistIpcSync } from './usePlaylistIpcSync';
import { usePlaylistItemOperations } from './usePlaylistItemOperations';
import { usePlaylistLoader } from './usePlaylistLoader';
import { usePlaylistNotes } from './usePlaylistNotes';
import { usePlaylistSaveFlow } from './usePlaylistSaveFlow';
import { usePlaylistSelection } from './usePlaylistSelection';
import { usePlaylistVideoControlsState } from './usePlaylistVideoControlsState';
import { usePlaylistVideoSourcesSync } from './usePlaylistVideoSourcesSync';
import { usePlaylistWindowCoreState } from './usePlaylistWindowCoreState';
import { usePlaylistWindowSync } from './usePlaylistWindowSync';

export interface PlaylistWindowDataRuntime {
  core: ReturnType<typeof usePlaylistWindowCoreState>;
  history: ReturnType<typeof usePlaylistHistory>;
  selection: ReturnType<typeof usePlaylistSelection>;
  exportState: ReturnType<typeof usePlaylistExportState>;
  sensors: ReturnType<typeof usePlaylistDndSensors>;
  notes: ReturnType<typeof usePlaylistNotes>;
  currentItemState: ReturnType<typeof usePlaylistCurrentItem>;
  annotations: ReturnType<typeof usePlaylistAnnotations>;
  videoControls: ReturnType<typeof usePlaylistVideoControlsState>;
  itemOperations: ReturnType<typeof usePlaylistItemOperations>;
  loader: ReturnType<typeof usePlaylistLoader>;
  saveFlow: ReturnType<typeof usePlaylistSaveFlow>;
  handleUndo: ReturnType<typeof usePlaylistHistorySync>['handleUndo'];
  handleRedo: ReturnType<typeof usePlaylistHistorySync>['handleRedo'];
}

export const usePlaylistWindowDataRuntime = (): PlaylistWindowDataRuntime => {
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

  return {
    core,
    history,
    selection,
    exportState,
    sensors,
    notes,
    currentItemState,
    annotations,
    videoControls,
    itemOperations,
    loader,
    saveFlow,
    handleUndo,
    handleRedo,
  };
};
