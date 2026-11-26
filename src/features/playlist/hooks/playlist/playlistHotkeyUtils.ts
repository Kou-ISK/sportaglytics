type PlaylistViewMode = 'dual' | 'angle1' | 'angle2';

interface PlaybackRefs {
  primary: React.RefObject<HTMLVideoElement | null>;
  secondary: React.RefObject<HTMLVideoElement | null>;
}

export const applyPlaybackRate = (refs: PlaybackRefs, rate: number): void => {
  for (const video of [refs.primary.current, refs.secondary.current]) {
    if (!video) continue;
    // A file boundary reloads the element and restores its default rate.
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
  }
};

export const buildSeekHandler = (
  handleSeek: (event: Event, value: number | number[]) => void,
  currentTime: number,
  deltaSeconds: number,
): (() => void) => {
  return () => {
    handleSeek(new Event('hotkey'), currentTime + deltaSeconds);
  };
};

export const buildSaveHandler = (
  loadedFilePath: string | null,
  handleSavePlaylist: (shouldCloseAfterSave?: boolean) => Promise<void>,
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>,
): (() => void) => {
  return () => {
    if (loadedFilePath) {
      void handleSavePlaylist(false);
      return;
    }
    setSaveDialogOpen(true);
  };
};

export const togglePlaylistViewMode = (
  currentMode: PlaylistViewMode,
  requestedMode: 'angle1' | 'angle2',
): PlaylistViewMode => {
  if (requestedMode === 'angle1') {
    if (currentMode === 'dual') return 'angle1';
    if (currentMode === 'angle1') return 'dual';
    return 'angle1';
  }

  if (currentMode === 'dual') return 'angle2';
  if (currentMode === 'angle2') return 'dual';
  return 'angle2';
};
