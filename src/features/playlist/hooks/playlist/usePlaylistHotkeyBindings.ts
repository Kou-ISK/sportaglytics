import { useMemo } from 'react';
import {
  buildPlaybackRateHandler,
  buildResetPlaybackRateHandler,
  buildSaveHandler,
  buildSeekHandler,
  togglePlaylistViewMode,
} from './playlistHotkeyUtils';

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
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoRef2: React.RefObject<HTMLVideoElement | null>;
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
  const playbackRefs = useMemo(
    () => ({
      primary: videoRef,
      secondary: videoRef2,
    }),
    [videoRef, videoRef2],
  );

  const resetPlaybackRate = buildResetPlaybackRateHandler(playbackRefs);

  const hotkeyHandlers = useMemo(
    () => ({
      'play-pause': handleTogglePlay,
      'skip-backward-medium': buildSeekHandler(handleSeek, currentTime, -5),
      'skip-backward-large': buildSeekHandler(handleSeek, currentTime, -10),
      'skip-forward-small': buildPlaybackRateHandler(playbackRefs, setIsPlaying, 0.5),
      'skip-forward-medium': buildPlaybackRateHandler(
        playbackRefs,
        setIsPlaying,
        2,
      ),
      'skip-forward-large': buildPlaybackRateHandler(playbackRefs, setIsPlaying, 4),
      'skip-forward-xlarge': buildPlaybackRateHandler(
        playbackRefs,
        setIsPlaying,
        6,
      ),
      'previous-item': handlePrevious,
      'next-item': handleNext,
      'delete-item': handleDeleteSelected,
      undo: handleUndo,
      redo: handleRedo,
      save: buildSaveHandler(
        loadedFilePath,
        handleSavePlaylist,
        setSaveDialogOpen,
      ),
      export: () => setExportDialogOpen(true),
      'toggle-angle1': () => {
        setViewMode((prev) => togglePlaylistViewMode(prev, 'angle1'));
      },
      'toggle-angle2': () => {
        setViewMode((prev) => togglePlaylistViewMode(prev, 'angle2'));
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
      playbackRefs,
    ],
  );

  const keyUpHandlers = useMemo(
    () => ({
      'skip-forward-small': resetPlaybackRate,
      'skip-forward-medium': resetPlaybackRate,
      'skip-forward-large': resetPlaybackRate,
      'skip-forward-xlarge': resetPlaybackRate,
    }),
    [resetPlaybackRate],
  );

  return { hotkeyHandlers, keyUpHandlers };
};
