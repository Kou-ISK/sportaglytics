import { usePlaylistWindowDataRuntime } from './usePlaylistWindowDataRuntime';
import { usePlaylistWindowInteractionRuntime } from './usePlaylistWindowInteractionRuntime';

export interface PlaylistWindowRuntime {
  core: ReturnType<typeof usePlaylistWindowDataRuntime>['core'];
  history: ReturnType<typeof usePlaylistWindowDataRuntime>['history'];
  selection: ReturnType<typeof usePlaylistWindowDataRuntime>['selection'];
  exportState: ReturnType<typeof usePlaylistWindowDataRuntime>['exportState'];
  sensors: ReturnType<typeof usePlaylistWindowDataRuntime>['sensors'];
  notes: ReturnType<typeof usePlaylistWindowDataRuntime>['notes'];
  currentItemState: ReturnType<
    typeof usePlaylistWindowDataRuntime
  >['currentItemState'];
  annotations: ReturnType<typeof usePlaylistWindowDataRuntime>['annotations'];
  videoControls: ReturnType<
    typeof usePlaylistWindowDataRuntime
  >['videoControls'];
  itemOperations: ReturnType<
    typeof usePlaylistWindowDataRuntime
  >['itemOperations'];
  loader: ReturnType<typeof usePlaylistWindowDataRuntime>['loader'];
  playback: ReturnType<
    typeof usePlaylistWindowInteractionRuntime
  >['playback'];
  handleUndo: ReturnType<typeof usePlaylistWindowDataRuntime>['handleUndo'];
  handleRedo: ReturnType<typeof usePlaylistWindowDataRuntime>['handleRedo'];
  saveFlow: ReturnType<typeof usePlaylistWindowDataRuntime>['saveFlow'];
  handleToggleDrawingMode: () => void;
}

export const usePlaylistWindowRuntime = (): PlaylistWindowRuntime => {
  const dataRuntime = usePlaylistWindowDataRuntime();
  const interactionRuntime = usePlaylistWindowInteractionRuntime(dataRuntime);

  return {
    ...dataRuntime,
    playback: interactionRuntime.playback,
    handleToggleDrawingMode: interactionRuntime.handleToggleDrawingMode,
  };
};
