import { useEffect } from 'react';
import type { VideoSyncData } from '../../../../types/VideoSync';

type UseVideoMetadataSyncParams = {
  metaDataConfigFilePath: string;
  syncData: VideoSyncData | undefined;
};

export const useVideoMetadataSync = ({
  metaDataConfigFilePath,
  syncData,
}: UseVideoMetadataSyncParams): void => {
  useEffect(() => {
    (async () => {
      try {
        if (
          !metaDataConfigFilePath ||
          !syncData ||
          !window.electronAPI ||
          typeof window.electronAPI.saveSyncData !== 'function'
        ) {
          return;
        }

        await window.electronAPI.saveSyncData(metaDataConfigFilePath, syncData);
      } catch (error) {
        console.error('[useVideoMetadataSync] saveSyncData failed', error);
      }
    })();
  }, [metaDataConfigFilePath, syncData]);

  useEffect(() => {
    if (!metaDataConfigFilePath) {
      window.electronAPI?.setWindowTitle?.('SporTagLytics');
      return;
    }

    (async () => {
      try {
        const config = await window.electronAPI?.readJsonFile?.(
          metaDataConfigFilePath,
        );

        if (!(config && typeof config === 'object' && 'packageName' in config)) {
          return;
        }

        const packageName = (config as { packageName?: string }).packageName;
        if (!packageName) {
          return;
        }

        window.electronAPI?.setWindowTitle?.(`${packageName} - SporTagLytics`);
      } catch (error) {
        console.error('[useVideoMetadataSync] window title sync failed', error);
      }
    })();
  }, [metaDataConfigFilePath]);
};
