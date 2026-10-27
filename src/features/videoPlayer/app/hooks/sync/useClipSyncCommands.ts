import {
  getNativePlayback,
  restoreNativeBeforeDocumentChange,
} from '../../../shared/nativePlayback/nativePlaybackRegistry';
import { useCallback, useEffect, useRef } from 'react';
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
  const transition = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      transition.current++;
    };
  }, []);
  const enterMode = useCallback(
    (mode: 'auto' | 'manual'): void => {
      const request = ++transition.current;
      setIsVideoPlaying(false);
      if (!getNativePlayback()) {
        setSyncMode(mode);
        return;
      }
      void restoreNativeBeforeDocumentChange()
        .then(() => {
          if (alive.current && request === transition.current)
            setSyncMode(mode);
        })
        .catch(() => {
          // Keep the old player mounted until original restoration is confirmed.
        });
    },
    [setIsVideoPlaying, setSyncMode],
  );
  const changeSyncMode = useCallback<
    Dispatch<SetStateAction<'auto' | 'manual'>>
  >(
    (update) => {
      if (captureActive) {
        transition.current++;
        return;
      }
      const next = typeof update === 'function' ? update(syncMode) : update;
      if (syncMode === 'manual' && next === 'auto') {
        window.dispatchEvent(new Event('clip-sync-cancel'));
        return;
      }
      enterMode(next);
    },
    [captureActive, enterMode, syncMode],
  );
  const requestClipSync = useCallback((): void => {
    if (captureActive) return;
    if (!mediaAngles.some((angle) => angle.clips.length > 0)) {
      void manualSyncFromPlayers();
      return;
    }
    setIsVideoPlaying(false);
    if (syncMode !== 'manual') enterMode('manual');
    else window.dispatchEvent(new Event('clip-sync-place'));
  }, [
    captureActive,
    mediaAngles,
    manualSyncFromPlayers,
    enterMode,
    setIsVideoPlaying,
    syncMode,
  ]);
  return { requestClipSync, changeSyncMode };
};
