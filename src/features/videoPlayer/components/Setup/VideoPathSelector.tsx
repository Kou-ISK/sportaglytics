import React, { useCallback, useState } from 'react';
import { Box, Stack, useTheme } from '@mui/material';
import type { VideoSyncData } from '../../../../types/VideoSync';
import { CreatePackageWizard } from './VideoPathSelector/CreatePackageWizard';
import { AudioSyncBackdrop } from './VideoPathSelector/AudioSyncBackdrop';
import {
  PackageLoadResult,
  VideoPathSelectorProps,
} from './VideoPathSelector/types';
import { useAudioSync } from './VideoPathSelector/hooks/useAudioSync';
import { useDragAndDrop } from './VideoPathSelector/hooks/useDragAndDrop';
import { useRecentPackages } from './VideoPathSelector/hooks/useRecentPackages';
import { useNotification } from '../../../../contexts/NotificationContext';
import { ONBOARDING_STORAGE_KEY } from '../../../../components/OnboardingTutorial';
import { buildVideoListFromConfig } from './VideoPathSelector/utils/angleUtils';
import { WelcomeHeader } from './VideoPathSelector/components/WelcomeHeader';
import { DropZoneCard } from './VideoPathSelector/components/DropZoneCard';
import { ActionButtonsRow } from './VideoPathSelector/components/ActionButtonsRow';
import { RecentPackagesSection } from './VideoPathSelector/components/RecentPackagesSection';

export const VideoPathSelector: React.FC<VideoPathSelectorProps> = ({
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
}) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const { performAudioSync, status: syncStatus } = useAudioSync({
    setSyncData,
  });
  const { recentPackages, addRecentPackage, removeRecentPackage } =
    useRecentPackages();
  const { notify } = useNotification();

  // オンボーディング未完了時のみウェルカムヘッダーを表示
  React.useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setShowWelcome(!completed);
  }, []);

  const handlePackageLoaded = useCallback(
    ({
      videoList,
      syncData,
      timelinePath,
      metaDataConfigFilePath,
      packagePath,
    }: PackageLoadResult) => {
      setVideoList(videoList);
      setSyncData(syncData);
      setTimelineFilePath(timelinePath);
      setMetaDataConfigFilePath(metaDataConfigFilePath);
      if (packagePath) {
        setPackagePath(packagePath);
      }
      setIsFileSelected(true);

      // 履歴に追加（metaDataからチーム名を取得）
      if (packagePath && metaDataConfigFilePath) {
        if (globalThis.window.electronAPI?.readJsonFile) {
          globalThis.window.electronAPI
            .readJsonFile(metaDataConfigFilePath)
            .then((config: unknown) => {
              const typedConfig = config as {
                team1Name?: string;
                team2Name?: string;
              };
              addRecentPackage({
                path: packagePath,
                name: packagePath.split('/').pop() || 'Unknown',
                team1Name: typedConfig.team1Name || 'Team 1',
                team2Name: typedConfig.team2Name || 'Team 2',
                videoCount: videoList.length,
              });
            })
            .catch((err) =>
              console.error('Failed to update recent packages:', err),
            );
        }
      }
    },
    [
      setIsFileSelected,
      setMetaDataConfigFilePath,
      setPackagePath,
      setSyncData,
      setTimelineFilePath,
      setVideoList,
      addRecentPackage,
    ],
  );

  const handlePackageCreated = useCallback(
    (payload: PackageLoadResult) => {
      handlePackageLoaded(payload);
      setWizardOpen(false);
      notify({ message: 'パッケージを作成しました', severity: 'success' });
    },
    [handlePackageLoaded, notify],
  );

  // ドラッグ&ドロップでパッケージを開く
  const handlePackageDrop = useCallback(
    async (packagePath: string) => {
      if (!globalThis.window.electronAPI) {
        notify({
          message: 'この機能はElectronアプリケーション内でのみ利用できます。',
          severity: 'error',
        });
        return;
      }

      const configFilePath = `${packagePath}/.metadata/config.json`;
      const exists =
        await globalThis.window.electronAPI?.checkFileExists?.(configFilePath);

      if (!exists) {
        notify({
          message:
            'パッケージフォルダ内に .metadata/config.json が見つかりません。',
          severity: 'error',
        });
        return;
      }

      try {
        if (!globalThis.window.electronAPI?.readJsonFile) {
          throw new Error('electronAPI.readJsonFile is not available');
        }
        const config =
          await globalThis.window.electronAPI.readJsonFile(configFilePath);

        const { videoList } = buildVideoListFromConfig(config, packagePath);

        if (!videoList.length) {
          throw new Error('アングルに映像が割り当てられていません。');
        }

        const typedConfig = config as {
          syncData?: VideoSyncData;
          angles?: unknown;
        };

        handlePackageLoaded({
          videoList,
          syncData: typedConfig.syncData,
          timelinePath: `${packagePath}/timeline.json`,
          metaDataConfigFilePath: configFilePath,
          packagePath,
        });

        notify({
          message: 'パッケージを開きました',
          severity: 'success',
        });
      } catch (error) {
        console.error('Failed to load dropped package:', error);
        notify({
          message: 'パッケージの読み込みに失敗しました',
          severity: 'error',
        });
      }
    },
    [handlePackageLoaded, notify],
  );

  const { dragState, handlers } = useDragAndDrop(handlePackageDrop);
  const theme = useTheme();

  // 最近のパッケージから開く
  const handleRecentPackageOpen = useCallback(
    (path: string) => {
      handlePackageDrop(path);
    },
    [handlePackageDrop],
  );

  // 外部からパッケージディレクトリが開かれたときの処理
  React.useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onPackageDirectoryOpen) return;

    const cleanup = api.onPackageDirectoryOpen((dirPath: string) => {
      console.log(`外部からパッケージディレクトリを開きます: ${dirPath}`);
      handlePackageDrop(dirPath);
    });

    return cleanup;
  }, [handlePackageDrop]);

  return (
    <Box
      sx={{
        width: '100%',
        mx: 'auto',
        mt: 2,
        px: { xs: 2, md: 3 },
        pb: 4,
        maxWidth: 1180,
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
      }}
      {...handlers}
    >
      <Stack spacing={4}>
        <WelcomeHeader show={showWelcome} />

        <DropZoneCard dragState={dragState} />

        <ActionButtonsRow
          onPackageLoaded={handlePackageLoaded}
          onOpenWizard={() => setWizardOpen(true)}
        />

        <RecentPackagesSection
          packages={recentPackages}
          onOpen={handleRecentPackageOpen}
          onRemove={removeRecentPackage}
        />
      </Stack>

      <CreatePackageWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onPackageCreated={handlePackageCreated}
        performAudioSync={performAudioSync}
        syncStatus={syncStatus}
      />

      <AudioSyncBackdrop status={syncStatus} />
    </Box>
  );
};
