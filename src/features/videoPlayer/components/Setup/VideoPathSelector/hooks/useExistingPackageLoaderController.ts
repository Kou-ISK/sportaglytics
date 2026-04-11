import { useCallback, useEffect } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import type { PackageLoadResult } from '../types';
import {
  loadPackageDirectory,
  pickPackagePath,
  subscribeToOpenPackage,
  subscribeToOpenRecentPackage,
  toPackageLoadErrorMessage,
} from '../gateway/packageGateway';

interface UseExistingPackageLoaderControllerParams {
  onPackageLoaded: (result: PackageLoadResult) => void;
}

interface ExistingPackageLoaderController {
  handleSelectPackage: (preselectedPath?: unknown) => Promise<void>;
}

export const useExistingPackageLoaderController = ({
  onPackageLoaded,
}: UseExistingPackageLoaderControllerParams): ExistingPackageLoaderController => {
  const { error: showError, info } = useNotification();

  const handleSelectPackage = useCallback(
    async (preselectedPath?: unknown): Promise<void> => {
      try {
        const packagePath = await pickPackagePath(preselectedPath);
        if (!packagePath) {
          return;
        }

        const loadedPackage = await loadPackageDirectory(packagePath);
        if (loadedPackage.missingSyncData) {
          info(
            '音声同期データがありません。必要に応じてメニューから同期を実行してください。',
          );
        }

        onPackageLoaded(loadedPackage.result);
      } catch (error) {
        console.error('Config.json の読み込みに失敗しました:', error);
        showError(toPackageLoadErrorMessage(error));
      }
    },
    [info, onPackageLoaded, showError],
  );

  useEffect(() => {
    const unsubscribeOpenPackage = subscribeToOpenPackage(() => {
      void handleSelectPackage();
    });
    const unsubscribeOpenRecentPackage = subscribeToOpenRecentPackage((path) => {
      void handleSelectPackage(path);
    });

    return () => {
      unsubscribeOpenPackage();
      unsubscribeOpenRecentPackage();
    };
  }, [handleSelectPackage]);

  return {
    handleSelectPackage,
  };
};
