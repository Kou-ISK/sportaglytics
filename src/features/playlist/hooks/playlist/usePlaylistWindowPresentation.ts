import { renderAnnotationPng } from '../../utils/renderAnnotationPng';
import {
  DEFAULT_FREEZE_DURATION,
  MIN_FREEZE_DURATION,
} from './playlistWindowController.constants';
import type { PlaylistWindowRuntime } from './usePlaylistWindowRuntime';
import { usePlaylistDialogHandlers } from './usePlaylistDialogHandlers';
import { usePlaylistWindowExportFlow } from './usePlaylistWindowExportFlow';
import { usePlaylistWindowMenuActions } from './usePlaylistWindowMenuActions';
import { usePlaylistWindowSections } from './usePlaylistWindowSections';

interface UsePlaylistWindowPresentationParams {
  runtime: PlaylistWindowRuntime;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const usePlaylistWindowPresentation = ({
  runtime,
  onSuccess,
  onError,
}: UsePlaylistWindowPresentationParams): ReturnType<
  typeof usePlaylistWindowSections
> => {
  const menuActions = usePlaylistWindowMenuActions({
    loadPlaylistFromPath: runtime.loader.loadPlaylistFromPath,
    loadedFilePath: runtime.core.loadedFilePath,
    handleSavePlaylist: runtime.saveFlow.handleSavePlaylist,
    setSaveDialogOpen: runtime.core.setSaveDialogOpen,
  });

  const exportFlow = usePlaylistWindowExportFlow({
    items: runtime.history.items,
    selectedItems: runtime.selection.selectedItems,
    videoSources: runtime.core.videoSources,
    exportScope: runtime.exportState.exportScope,
    angleOption: runtime.exportState.angleOption,
    selectedAngleIndex: runtime.exportState.selectedAngleIndex,
    exportMode: runtime.exportState.exportMode,
    exportFileName: runtime.exportState.exportFileName,
    overlaySettings: runtime.exportState.overlaySettings,
    itemAnnotations: runtime.core.itemAnnotations,
    minFreezeDuration: MIN_FREEZE_DURATION,
    primaryContentRect: runtime.core.primaryContentRect,
    secondaryContentRect: runtime.core.secondaryContentRect,
    primarySourceSize: runtime.core.primarySourceSize,
    secondarySourceSize: runtime.core.secondarySourceSize,
    renderAnnotationPng,
    onMissingApi: onError,
    onSuccess,
    onError,
    setExportDialogOpen: runtime.exportState.setExportDialogOpen,
  });

  const dialogHandlers = usePlaylistDialogHandlers({
    setSaveDialogOpen: runtime.core.setSaveDialogOpen,
    setCloseAfterSave: runtime.core.setCloseAfterSave,
    setExportDialogOpen: runtime.exportState.setExportDialogOpen,
    setNoteDialogOpen: runtime.notes.setNoteDialogOpen,
    setEditingItemId: runtime.notes.setEditingItemId,
    onCloseExportProgress: exportFlow.clearExportProgress,
  });

  return usePlaylistWindowSections({
    core: runtime.core,
    history: runtime.history,
    selection: runtime.selection,
    currentItemState: runtime.currentItemState,
    annotations: runtime.annotations,
    videoControls: runtime.videoControls,
    playback: runtime.playback,
    notes: runtime.notes,
    menuActions,
    exportState: runtime.exportState,
    exportFlow,
    dialogHandlers,
    saveFlow: runtime.saveFlow,
    itemOperations: runtime.itemOperations,
    sensors: runtime.sensors,
    handleToggleDrawingMode: runtime.handleToggleDrawingMode,
    defaultFreezeDuration: DEFAULT_FREEZE_DURATION,
  });
};
