type PlaylistViewMode = 'dual' | 'angle1' | 'angle2';

interface PlaybackRefs {
  primary: React.RefObject<HTMLVideoElement | null>;
  secondary: React.RefObject<HTMLVideoElement | null>;
}

export const applyPlaybackRate = (
  refs: PlaybackRefs,
  rate: number,
): void => {
  if (refs.primary.current) {
    refs.primary.current.playbackRate = rate;
  }
  if (refs.secondary.current) {
    refs.secondary.current.playbackRate = rate;
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

export const buildPlaybackRateHandler = (
  refs: PlaybackRefs,
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
  rate: number,
): (() => void) => {
  return () => {
    applyPlaybackRate(refs, rate);
    setIsPlaying(true);
  };
};

export const buildResetPlaybackRateHandler = (
  refs: PlaybackRefs,
): (() => void) => {
  return () => {
    applyPlaybackRate(refs, 1);
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
