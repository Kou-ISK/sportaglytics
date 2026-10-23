import type { PackageOpenProgress } from '../../../../../../types/package/openProgress';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PackageLoadResult } from '../types';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  loadPackageDirectory,
  subscribeToPackageOpenProgress,
  cancelPackageOpenRequest,
  pickPackagePath,
  releasePackageSessionReservation,
  subscribeToOpenPackage,
  subscribeToOpenRecentPackage,
  subscribeToPackageDirectoryOpen,
  toPackageLoadErrorMessage,
} from '../gateway/packageGateway';
export interface StartPackageOpen {
  busy: boolean;
  progress: PackageOpenProgress | null;
  cancel: () => void;
  error: string;
  errorDetails: string;
  invalidDrop: boolean;
  open: (path?: string, source?: 'open' | 'drop') => Promise<void>;
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
  const request = useRef<string | null>(null);
  const [progress, setProgress] = useState<PackageOpenProgress | null>(null);
  const { info } = useNotification();
  const open = useCallback(
    async (path?: string, source: 'open' | 'drop' = 'open'): Promise<void> => {
      if (opening.current) return;
      opening.current = true;
      const requestId = crypto.randomUUID();
      request.current = requestId;
      setProgress(null);
      setBusy(true);
      setFailure(null);
      let selectedPath = path;
      try {
        selectedPath = (await pickPackagePath(path)) ?? undefined;
        if (!selectedPath || request.current !== requestId) return;
        const loaded = await loadPackageDirectory(
          selectedPath,
          requestId,
          () => request.current === requestId,
        );
        if (request.current !== requestId) return;
        const notices = [
          loaded.warning,
          loaded.missingSyncData
            ? '音声同期データがありません。必要に応じてメニューから同期を実行してください。'
            : undefined,
        ].filter(Boolean);
        if (notices.length) info(notices.join(' '));
        onLoaded(loaded.result);
      } catch (error: unknown) {
        if (request.current !== requestId) return;
        // Native open routing may reserve the source before preparation starts.
        if (selectedPath)
          await releasePackageSessionReservation(selectedPath, requestId);
        if (
          error instanceof Error &&
          error.message.includes('PACKAGE_OPEN_CANCELLED')
        )
          return;
        const invalidDrop =
          source === 'drop' &&
          error instanceof Error &&
          error.message.includes('PACKAGE_SOURCE_NOT_DIRECTORY');
        setFailure({
          path: invalidDrop ? undefined : selectedPath,
          invalidDrop,
          message: invalidDrop
            ? 'プロジェクトのファイルまたはフォルダを選んでください。映像ファイルは「新しいパッケージを作成」から追加できます。'
            : toPackageLoadErrorMessage(error),
          details: [selectedPath, error instanceof Error ? error.message : '']
            .filter(Boolean)
            .join('\n'),
        });
      } finally {
        if (request.current === requestId) {
          request.current = null;
          opening.current = false;
          setProgress(null);
          setBusy(false);
        }
      }
    },
    [info, onLoaded],
  );
  useEffect(() => {
    const cleanup = [
      subscribeToPackageOpenProgress((state) => {
        if (state.requestId === request.current) setProgress(state);
      }),
      subscribeToOpenPackage(() => void open()),
      subscribeToOpenRecentPackage((path) => void open(path)),
      subscribeToPackageDirectoryOpen((path) => void open(path)),
    ];
    return () => {
      cleanup.forEach((unsubscribe) => unsubscribe());
    };
  }, [open]);
  useEffect(
    () => () => {
      const id = request.current;
      request.current = null;
      if (id) void cancelPackageOpenRequest(id).catch(() => undefined);
    },
    [],
  );
  return {
    busy,
    progress,
    cancel: () => {
      const id = request.current;
      if (!id || !progress?.canCancel) return;
      void cancelPackageOpenRequest(id).catch((error: unknown) => {
        if (request.current !== id) return;
        setFailure({
          message: '読み込みの取消要求を送れませんでした。',
          details: error instanceof Error ? error.message : '',
        });
      });
    },
    error: failure?.message ?? '',
    errorDetails: failure?.details ?? '',
    invalidDrop: failure?.invalidDrop ?? false,
    open,
    retry: () => void open(failure?.path),
    dismissError: () => setFailure(null),
    reportInvalidDrop: () =>
      setFailure({
        message:
          '開くファイルまたはフォルダを1つドロップしてください。映像ファイルは「新しいパッケージを作成」から追加できます。',
        details: '',
        invalidDrop: true,
      }),
  };
};
