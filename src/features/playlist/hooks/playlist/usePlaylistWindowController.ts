import { useNotification } from '../../../../contexts/NotificationContext';
import { usePlaylistWindowPresentation } from './usePlaylistWindowPresentation';
import { usePlaylistWindowRuntime } from './usePlaylistWindowRuntime';

export const usePlaylistWindowController = () => {
  const { success, error: showError } = useNotification();
  const runtime = usePlaylistWindowRuntime();
  const { header, videoArea, itemSection, nowPlaying, dialogs } =
    usePlaylistWindowPresentation({
      runtime,
      onSuccess: success,
      onError: showError,
    });

  return {
    containerRef: runtime.core.containerRef,
    header,
    videoArea,
    itemSection,
    nowPlaying,
    dialogs,
  };
};

export type PlaylistWindowController = ReturnType<
  typeof usePlaylistWindowController
>;
