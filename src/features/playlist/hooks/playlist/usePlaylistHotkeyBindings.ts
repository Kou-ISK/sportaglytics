import { useCallback, useMemo } from 'react';
import {
  buildPlaybackRateHandler,
  buildResetPlaybackRateHandler,
  buildSaveHandler,
  togglePlaylistViewMode,
} from './playlistHotkeyUtils';

interface UsePlaylistHotkeyBindingsParams {
  handleTogglePlay: () => void;
  startReversePlayback: (rate: 0.5 | 2 | 4 | 6) => void;
  stopReversePlayback: () => void;
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
  handleTogglePlay,
  startReversePlayback,
  stopReversePlayback,
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
  const startForwardPlayback = useCallback(
    (rate: 0.5 | 2 | 4 | 6): (() => void) => {
      const start = buildPlaybackRateHandler(playbackRefs, setIsPlaying, rate);
      return () => {
        stopReversePlayback();
        start();
      };
    },
    [playbackRefs, setIsPlaying, stopReversePlayback],
  );

  const hotkeyHandlers = useMemo(
    () => ({
      'play-pause': () => {
        stopReversePlayback();
        handleTogglePlay();
      },
      'reverse-playback-slow': () => startReversePlayback(0.5),
      'reverse-playback-2x': () => startReversePlayback(2),
      'reverse-playback-4x': () => startReversePlayback(4),
      'reverse-playback-6x': () => startReversePlayback(6),
      'skip-forward-small': startForwardPlayback(0.5),
      'skip-forward-medium': startForwardPlayback(2),
      'skip-forward-large': startForwardPlayback(4),
      'skip-forward-xlarge': startForwardPlayback(6),
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
      handleDeleteSelected,
      handleNext,
      handlePrevious,
      handleRedo,
      handleSavePlaylist,
      handleTogglePlay,
      handleUndo,
      loadedFilePath,
      setExportDialogOpen,
      setIsPlaying,
      setSaveDialogOpen,
      setViewMode,
      playbackRefs,
      startReversePlayback,
      startForwardPlayback,
      stopReversePlayback,
    ],
  );

  const keyUpHandlers = useMemo(
    () => ({
      'skip-forward-small': resetPlaybackRate,
      'skip-forward-medium': resetPlaybackRate,
      'skip-forward-large': resetPlaybackRate,
      'skip-forward-xlarge': resetPlaybackRate,
      'reverse-playback-slow': stopReversePlayback,
      'reverse-playback-2x': stopReversePlayback,
      'reverse-playback-4x': stopReversePlayback,
      'reverse-playback-6x': stopReversePlayback,
    }),
    [resetPlaybackRate, stopReversePlayback],
  );

  return { hotkeyHandlers, keyUpHandlers };
};
