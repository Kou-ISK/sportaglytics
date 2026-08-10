import { useEffect } from 'react';
import {
  readVideoMetadataPackageName,
  setVideoWindowTitle,
} from '../gateways/videoMetadataGateway';

export const useVideoWindowTitle = (metaDataConfigFilePath: string): void => {
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
        console.error('[useVideoWindowTitle] window title sync failed', error);
      }
    })();
  }, [metaDataConfigFilePath]);
};
