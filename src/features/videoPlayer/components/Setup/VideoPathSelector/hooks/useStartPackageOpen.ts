import { useCallback, useEffect, useRef, useState } from 'react';
import type { PackageLoadResult } from '../types';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  loadPackageDirectory,
  pickPackagePath,
  releasePackageSessionReservation,
  subscribeToOpenPackage,
  subscribeToOpenRecentPackage,
  subscribeToPackageDirectoryOpen,
  toPackageLoadErrorMessage,
} from '../gateway/packageGateway';
export interface StartPackageOpen {
  busy: boolean;
  error: string;
  errorDetails: string;
  invalidDrop: boolean;
  open: (path?: string) => Promise<void>;
  retry: () => void;
  dismissError: () => void;
  reportInvalidDrop: () => void;
}
/** 開く・履歴・drop・native menuを同じロード状態に集約する。 */
export const useStartPackageOpen = (
  onLoaded: (result: PackageLoadResult) => void,
): StartPackageOpen => {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    path?: string;
    message: string;
    details: string;
    invalidDrop?: boolean;
  } | null>(null);
  const opening = useRef(false);
  const { info } = useNotification();
  const open = useCallback(
    async (path?: string): Promise<void> => {
      if (opening.current) return;
      opening.current = true;
      setBusy(true);
      setFailure(null);
      let selectedPath = path;
      try {
        selectedPath = (await pickPackagePath(path)) ?? undefined;
        if (!selectedPath) return;
        const loaded = await loadPackageDirectory(selectedPath);
        if (loaded.missingSyncData)
          info(
            '音声同期データがありません。必要に応じてメニューから同期を実行してください。',
          );
        onLoaded(loaded.result);
      } catch (error: unknown) {
        if (selectedPath) await releasePackageSessionReservation(selectedPath);
        setFailure({
          path: selectedPath,
          message: toPackageLoadErrorMessage(error),
          details: [selectedPath, error instanceof Error ? error.message : '']
            .filter(Boolean)
            .join('\n'),
        });
      } finally {
        opening.current = false;
        setBusy(false);
      }
    },
    [info, onLoaded],
  );
  useEffect(() => {
    const cleanup = [
      subscribeToOpenPackage(() => void open()),
      subscribeToOpenRecentPackage((path) => void open(path)),
      subscribeToPackageDirectoryOpen((path) => void open(path)),
    ];
    return () => cleanup.forEach((unsubscribe) => unsubscribe());
  }, [open]);
  return {
    busy,
    error: failure?.message ?? '',
    errorDetails: failure?.details ?? '',
    invalidDrop: failure?.invalidDrop ?? false,
    open,
    retry: () => void open(failure?.path),
    dismissError: () => setFailure(null),
    reportInvalidDrop: () =>
      setFailure({
        message:
          '.stpkg パッケージを1つドロップしてください。映像ファイルは「新しいパッケージを作成」から追加できます。',
        details: '',
        invalidDrop: true,
      }),
  };
};
