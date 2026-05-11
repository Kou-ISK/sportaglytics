import { useCallback, useEffect } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import type { PackageLoadResult } from '../types';
import {
  loadPackageDirectory,
  subscribeToPackageDirectoryOpen,
  toPackageLoadErrorMessage,
} from '../gateway/packageGateway';

interface UsePackageDropLoaderParams {
  onPackageLoaded: (payload: PackageLoadResult) => void;
}

interface PackageDropLoaderController {
  handlePackageDrop: (packagePath: string) => Promise<void>;
}

export const usePackageDropLoader = ({
  onPackageLoaded,
}: UsePackageDropLoaderParams): PackageDropLoaderController => {
  const { notify } = useNotification();

  const handlePackageDrop = useCallback(
    async (packagePath: string): Promise<void> => {
      try {
        const loadedPackage = await loadPackageDirectory(packagePath);
        onPackageLoaded(loadedPackage.result);
        notify({
          message: 'パッケージを開きました',
          severity: 'success',
        });
      } catch (error) {
        console.error('Failed to load dropped package:', error);
        notify({
          message: toPackageLoadErrorMessage(error),
          severity: 'error',
        });
      }
    },
    [notify, onPackageLoaded],
  );

  useEffect(() => {
    const cleanup = subscribeToPackageDirectoryOpen((dirPath) => {
      void handlePackageDrop(dirPath);
    });

    return cleanup;
  }, [handlePackageDrop]);

  return {
    handlePackageDrop,
  };
};
