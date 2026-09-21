import { useHeldPlayback } from '../../../../shared/hooks/useHeldPlayback';
import { useCallback, useMemo } from 'react';
import {
  applyPlaybackRate,
  buildSaveHandler,
  togglePlaylistViewMode,
} from './playlistHotkeyUtils';

interface UsePlaylistHotkeyBindingsParams {
  isPlaying: boolean;
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
  isPlaying,
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

  const { start, stop, cancel } = useHeldPlayback(
    () => ({ playing: isPlaying, rate: videoRef.current?.playbackRate ?? 1 }),
    ({ playing, rate }) => {
      applyPlaybackRate(playbackRefs, rate);
      setIsPlaying(playing);
    },
  );
  const startForwardPlayback = useCallback(
    (id: string, rate: number): (() => void) =>
      () => {
        stopReversePlayback();
        start(id, rate);
      },
    [start, stopReversePlayback],
  );

  const hotkeyHandlers = useMemo(
    () => ({
      'play-pause': () => {
        cancel();
        stopReversePlayback();
        handleTogglePlay();
      },
      'reverse-playback-slow': () => {
        cancel();
        startReversePlayback(0.5);
      },
      'reverse-playback-2x': () => {
        cancel();
        startReversePlayback(2);
      },
      'reverse-playback-4x': () => {
        cancel();
        startReversePlayback(4);
      },
      'reverse-playback-6x': () => {
        cancel();
        startReversePlayback(6);
      },
      'skip-forward-small': startForwardPlayback('skip-forward-small', 0.5),
      'skip-forward-medium': startForwardPlayback('skip-forward-medium', 2),
      'skip-forward-large': startForwardPlayback('skip-forward-large', 4),
      'skip-forward-xlarge': startForwardPlayback('skip-forward-xlarge', 6),
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
      cancel,
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
      'skip-forward-small': () => stop('skip-forward-small'),
      'skip-forward-medium': () => stop('skip-forward-medium'),
      'skip-forward-large': () => stop('skip-forward-large'),
      'skip-forward-xlarge': () => stop('skip-forward-xlarge'),
      'reverse-playback-slow': stopReversePlayback,
      'reverse-playback-2x': stopReversePlayback,
      'reverse-playback-4x': stopReversePlayback,
      'reverse-playback-6x': stopReversePlayback,
    }),
    [stop, stopReversePlayback],
  );

  return { hotkeyHandlers, keyUpHandlers };
};
