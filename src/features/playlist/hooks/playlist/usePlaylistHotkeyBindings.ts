import { useMemo } from 'react';

interface UsePlaylistHotkeyBindingsParams {
  currentTime: number;
  handleTogglePlay: () => void;
  handleSeek: (event: Event, value: number | number[]) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  handleDeleteSelected: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSavePlaylist: (shouldCloseAfterSave?: boolean) => Promise<void>;
  loadedFilePath: string | null;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setViewMode: React.Dispatch<
    React.SetStateAction<'dual' | 'angle1' | 'angle2'>
  >;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoRef2: React.RefObject<HTMLVideoElement>;
}

interface UsePlaylistHotkeyBindingsResult {
  hotkeyHandlers: Record<string, () => void>;
  keyUpHandlers: Record<string, () => void>;
}

export const usePlaylistHotkeyBindings = ({
  currentTime,
  handleTogglePlay,
  handleSeek,
  handlePrevious,
  handleNext,
  handleDeleteSelected,
  handleUndo,
  handleRedo,
  handleSavePlaylist,
  loadedFilePath,
  setSaveDialogOpen,
  setExportDialogOpen,
  setViewMode,
  setIsPlaying,
  videoRef,
  videoRef2,
}: UsePlaylistHotkeyBindingsParams): UsePlaylistHotkeyBindingsResult => {
  const hotkeyHandlers = useMemo(
    () => ({
      'play-pause': handleTogglePlay,
      'skip-backward-medium': () => {
        const newTime = currentTime - 5;
        handleSeek(new Event('hotkey'), newTime);
      },
      'skip-backward-large': () => {
        const newTime = currentTime - 10;
        handleSeek(new Event('hotkey'), newTime);
      },
      'skip-forward-small': () => {
        if (videoRef.current) videoRef.current.playbackRate = 0.5;
        if (videoRef2.current) videoRef2.current.playbackRate = 0.5;
        setIsPlaying(true);
      },
      'skip-forward-medium': () => {
        if (videoRef.current) videoRef.current.playbackRate = 2;
        if (videoRef2.current) videoRef2.current.playbackRate = 2;
        setIsPlaying(true);
      },
      'skip-forward-large': () => {
        if (videoRef.current) videoRef.current.playbackRate = 4;
        if (videoRef2.current) videoRef2.current.playbackRate = 4;
        setIsPlaying(true);
      },
      'skip-forward-xlarge': () => {
        if (videoRef.current) videoRef.current.playbackRate = 6;
        if (videoRef2.current) videoRef2.current.playbackRate = 6;
        setIsPlaying(true);
      },
      'previous-item': handlePrevious,
      'next-item': handleNext,
      'delete-item': handleDeleteSelected,
      undo: handleUndo,
      redo: handleRedo,
      save: () => {
        console.log(
          '[PlaylistWindow] Hotkey Save pressed. loadedFilePath:',
          loadedFilePath,
        );
        if (loadedFilePath) {
          console.log('[PlaylistWindow] Saving via hotkey to:', loadedFilePath);
          void handleSavePlaylist(false);
        } else {
          console.log(
            '[PlaylistWindow] No loadedFilePath, showing dialog via hotkey',
          );
          setSaveDialogOpen(true);
        }
      },
      export: () => setExportDialogOpen(true),
      'toggle-angle1': () => {
        setViewMode((prev) => {
          if (prev === 'dual') return 'angle1';
          if (prev === 'angle1') return 'dual';
          if (prev === 'angle2') return 'angle1';
          return 'angle1';
        });
      },
      'toggle-angle2': () => {
        setViewMode((prev) => {
          if (prev === 'dual') return 'angle2';
          if (prev === 'angle2') return 'dual';
          if (prev === 'angle1') return 'angle2';
          return 'angle2';
        });
      },
    }),
    [
      currentTime,
      handleDeleteSelected,
      handleNext,
      handlePrevious,
      handleRedo,
      handleSavePlaylist,
      handleSeek,
      handleTogglePlay,
      handleUndo,
      loadedFilePath,
      setExportDialogOpen,
      setIsPlaying,
      setSaveDialogOpen,
      setViewMode,
      videoRef,
      videoRef2,
    ],
  );

  const keyUpHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-medium': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-large': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
      'skip-forward-xlarge': () => {
        if (videoRef.current) videoRef.current.playbackRate = 1;
        if (videoRef2.current) videoRef2.current.playbackRate = 1;
      },
    }),
    [videoRef, videoRef2],
  );

  return { hotkeyHandlers, keyUpHandlers };
};
