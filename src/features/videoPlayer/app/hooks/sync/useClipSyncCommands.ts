import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';

interface ClipSyncCommandParams {
  mediaAngles: PackageMediaAngle[];
  syncMode: 'auto' | 'manual';
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  manualSyncFromPlayers: () => Promise<void>;
}

/** Keep menu and keyboard entry points on the same draft/save lifecycle. */
export const useClipSyncCommands = ({
  mediaAngles,
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
      const next = typeof update === 'function' ? update(syncMode) : update;
      if (syncMode === 'manual' && next === 'auto') {
        window.dispatchEvent(new Event('clip-sync-cancel'));
        return;
      }
      setIsVideoPlaying(false);
      setSyncMode(next);
    },
    [setIsVideoPlaying, setSyncMode, syncMode],
  );
  const requestClipSync = useCallback((): void => {
    if (!mediaAngles.some((angle) => angle.clips.length > 0)) {
      void manualSyncFromPlayers();
      return;
    }
    setIsVideoPlaying(false);
    if (syncMode !== 'manual') setSyncMode('manual');
    else window.dispatchEvent(new Event('clip-sync-place'));
  }, [
    mediaAngles,
    manualSyncFromPlayers,
    setSyncMode,
    setIsVideoPlaying,
    syncMode,
  ]);
  return { requestClipSync, changeSyncMode };
};
