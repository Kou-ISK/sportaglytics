import { useEffect, useCallback } from 'react';
import { safeMenuCleanup } from './menuHandlerUtils';
import { subscribeSyncMenu } from '../gateways/menuEventGateway';

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
    const unsubscribe = subscribeSyncMenu({
      onResyncAudio: handleResync,
      onResetSync: handleReset,
      onManualSync: handleManual,
      onSetSyncMode: handleSetMode,
    });

    return () => {
      safeMenuCleanup(unsubscribe);
    };
  }, [handleResync, handleReset, handleManual, handleSetMode]);
};
