import { useEffect } from 'react';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  readVideoMetadataPackageName,
  saveVideoMetadataSyncData,
  setVideoWindowTitle,
} from '../gateways/videoMetadataGateway';

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
        if (!metaDataConfigFilePath || !syncData) {
          return;
        }

        await saveVideoMetadataSyncData(metaDataConfigFilePath, syncData);
      } catch (error) {
        console.error('[useVideoMetadataSync] saveSyncData failed', error);
      }
    })();
  }, [metaDataConfigFilePath, syncData]);

  useEffect(() => {
    if (!metaDataConfigFilePath) {
      setVideoWindowTitle('SporTagLytics');
      return;
    }

    (async () => {
      try {
        const packageName = await readVideoMetadataPackageName(
          metaDataConfigFilePath,
        );
        if (!packageName) {
          return;
        }

        setVideoWindowTitle(`${packageName} - SporTagLytics`);
      } catch (error) {
        console.error('[useVideoMetadataSync] window title sync failed', error);
      }
    })();
  }, [metaDataConfigFilePath]);
};
