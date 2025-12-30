import React, { useEffect } from 'react';
import { Button } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { VideoSyncData } from '../../../../../types/VideoSync';
import { PackageLoadResult } from './types';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { buildVideoListFromConfig } from './utils/angleUtils';

interface ExistingPackageLoaderProps {
  onPackageLoaded: (result: PackageLoadResult) => void;
}

const normalizePathValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'path' in value &&
    typeof (value as { path?: unknown }).path === 'string'
  ) {
    return (value as { path: string }).path;
  }
  return undefined;
};

export const ExistingPackageLoader: React.FC<ExistingPackageLoaderProps> = ({
  onPackageLoaded,
}) => {
  const { error: showError, info } = useNotification();

  const handleSelectPackage = async (preselectedPath?: unknown) => {
    if (!globalThis.window.electronAPI) {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
      return;
    }

    const normalized = normalizePathValue(preselectedPath);

    const packagePath =
      normalized ||
      (await globalThis.window.electronAPI?.openDirectory());
    if (!packagePath) {
      return;
    }

    const configFilePath = `${packagePath}/.metadata/config.json`;

    if (globalThis.window.electronAPI?.convertConfigToRelativePath) {
      try {
        await globalThis.window.electronAPI.convertConfigToRelativePath(
          packagePath,
        );
      } catch (error) {
        console.warn('config.json変換をスキップ:', error);
      }
    }

    const exists =
      await globalThis.window.electronAPI?.checkFileExists?.(configFilePath);
    if (!exists) {
      showError(
        '選択したパッケージ内に .metadata/config.json が見つかりません。',
      );
      return;
    }

    try {
      const response = await fetch(configFilePath);
      if (!response.ok) {
        throw new Error('Failed to load config.json');
      }
      const config = await response.json();

      const { videoList } = buildVideoListFromConfig(config, packagePath);

      if (!videoList.length) {
        throw new Error('アングルに映像が割り当てられていません。');
      }

      let resultingSyncData: VideoSyncData | undefined;
      const storedSync = config.syncData as
        | {
            syncOffset?: unknown;
            isAnalyzed?: unknown;
            confidenceScore?: unknown;
          }
        | undefined;

      if (videoList.length >= 2) {
        if (storedSync && typeof storedSync.syncOffset === 'number') {
          resultingSyncData = {
            syncOffset: storedSync.syncOffset,
            isAnalyzed: !!storedSync.isAnalyzed,
            confidenceScore:
              typeof storedSync.confidenceScore === 'number'
                ? storedSync.confidenceScore
                : undefined,
          } as VideoSyncData;
        } else {
          resultingSyncData = undefined;
          info('音声同期データがありません。必要に応じてメニューから同期を実行してください。');
        }
      } else {
        resultingSyncData = undefined;
      }

      onPackageLoaded({
        videoList,
        syncData: resultingSyncData,
        timelinePath: `${packagePath}/timeline.json`,
        metaDataConfigFilePath: configFilePath,
        packagePath,
      });
    } catch (error) {
      console.error('Config.json の読み込みに失敗しました:', error);
      showError('パッケージの読み込み中にエラーが発生しました。');
    }
  };

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onOpenPackage) return;
    api.onOpenPackage(handleSelectPackage);
  }, []);

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onOpenRecentPackage) return;
    api.onOpenRecentPackage((path) => handleSelectPackage(path));
  }, []);

  return (
    <Button
      sx={{ height: '60px', fontSize: '16px', flex: 1 }}
      onClick={() => {
        void handleSelectPackage();
      }}
      variant="contained"
      size="large"
      startIcon={<FolderOpenIcon />}
    >
      既存パッケージを開く
    </Button>
  );
};
