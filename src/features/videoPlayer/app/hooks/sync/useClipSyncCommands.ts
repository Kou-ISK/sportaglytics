import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';

interface ClipSyncCommandParams {
  mediaAngles: PackageMediaAngle[];
  captureActive?: boolean;
  syncMode: 'auto' | 'manual';
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  manualSyncFromPlayers: () => Promise<void>;
}

/** Keep menu and keyboard entry points on the same draft/save lifecycle. */
export const useClipSyncCommands = ({
  mediaAngles,
  captureActive = false,
  syncMode,
  setSyncMode,
  setIsVideoPlaying,
  manualSyncFromPlayers,
}: ClipSyncCommandParams): {
  requestClipSync: () => void;
  changeSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
} => {
  const changeSyncMode = useCallback<
    Dispatch<SetStateAction<'auto' | 'manual'>>
  >(
    (update) => {
      if (captureActive) return;
      const next = typeof update === 'function' ? update(syncMode) : update;
      if (syncMode === 'manual' && next === 'auto') {
        window.dispatchEvent(new Event('clip-sync-cancel'));
        return;
      }
      setIsVideoPlaying(false);
      setSyncMode(next);
    },
    [captureActive, setIsVideoPlaying, setSyncMode, syncMode],
  );
  const requestClipSync = useCallback((): void => {
    if (captureActive) return;
    if (!mediaAngles.some((angle) => angle.clips.length > 0)) {
      void manualSyncFromPlayers();
      return;
    }
    setIsVideoPlaying(false);
    if (syncMode !== 'manual') setSyncMode('manual');
    else window.dispatchEvent(new Event('clip-sync-place'));
  }, [
    captureActive,
    mediaAngles,
    manualSyncFromPlayers,
    setSyncMode,
    setIsVideoPlaying,
    syncMode,
  ]);
  return { requestClipSync, changeSyncMode };
};
