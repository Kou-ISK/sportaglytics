import { useEffect } from 'react';
import { usePlaylistStudio } from '../../studio/usePlaylistStudio';
import { useNotification } from '../../../../contexts/NotificationContext';
import { usePlaylistWindowPresentation } from './usePlaylistWindowPresentation';
import { usePlaylistWindowRuntime } from './usePlaylistWindowRuntime';

export const usePlaylistWindowController = () => {
  const { success, error: showError } = useNotification();
  const runtime = usePlaylistWindowRuntime();
  useEffect(() => {
    window.electronAPI?.setVideoWindowAspect?.(null);
  }, []);
  const {
    header,
    videoArea,
    itemSection,
    nowPlaying,
    sorter,
    organizer,
    inspector,
    shell,
    dialogs,
  } = usePlaylistWindowPresentation({
    runtime,
    onSuccess: success,
    onError: showError,
  });

  const studio = usePlaylistStudio(runtime);

  return {
    mediaStatus: {
      loading: runtime.playback.mediaTimeline.loading,
      error: runtime.playback.mediaTimeline.error,
      onRetry: runtime.playback.mediaTimeline.retry,
    },
    studio,
    containerRef: runtime.core.containerRef,
    header: { ...header, onWorkspaceModeChange: studio.onModeChange },
    videoArea,
    itemSection,
    nowPlaying,
    sorter,
    organizer,
    inspector,
    shell,
    dialogs,
  };
};

export type PlaylistWindowController = ReturnType<
  typeof usePlaylistWindowController
>;
