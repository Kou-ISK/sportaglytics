import { useEffect, useCallback } from 'react';
import { safeMenuCleanup } from './menuHandlerUtils';

interface UseSyncMenuHandlersParams {
  onResyncAudio: () => void | Promise<void>;
  onResetSync: () => void | Promise<void>;
  onManualSync: () => void | Promise<void>;
  onSetSyncMode: (mode: 'auto' | 'manual') => void;
}

export const useSyncMenuHandlers = ({
  onResyncAudio,
  onResetSync,
  onManualSync,
  onSetSyncMode,
}: UseSyncMenuHandlersParams): void => {
  const handleResync = useCallback(() => onResyncAudio(), [onResyncAudio]);
  const handleReset = useCallback(() => onResetSync(), [onResetSync]);
  const handleManual = useCallback(() => onManualSync(), [onManualSync]);
  const handleSetMode = useCallback(
    (mode: 'auto' | 'manual') => onSetSyncMode(mode),
    [onSetSyncMode],
  );

  useEffect(() => {
    if (!globalThis.window.electronAPI) {
      return;
    }

    const api = globalThis.window.electronAPI;

    api.onResyncAudio(handleResync);
    api.onResetSync(handleReset);
    api.onManualSync(handleManual);
    api.onSetSyncMode(handleSetMode);

    return () => {
      safeMenuCleanup(() => {
        api.offResyncAudio?.(handleResync);
        api.offResetSync?.(handleReset);
        api.offManualSync?.(handleManual);
        api.offSetSyncMode?.(handleSetMode);
      });
    };
  }, [handleResync, handleReset, handleManual, handleSetMode]);
};
