import { useEffect, useCallback } from 'react';

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
}: UseSyncMenuHandlersParams) => {
  // useCallbackで安定した関数参照を作成
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
    console.log('[SYNC] 同期メニューイベントリスナー登録完了');

    return () => {
      try {
        api.offResyncAudio?.(handleResync);
        api.offResetSync?.(handleReset);
        api.offManualSync?.(handleManual);
        api.offSetSyncMode?.(handleSetMode);
        console.log('[SYNC] 同期メニューリスナー解除完了');
      } catch (error) {
        console.debug('メニューイベントの解除エラー', error);
      }
    };
  }, [handleResync, handleReset, handleManual, handleSetMode]); // useCallbackで安定した参照
};
