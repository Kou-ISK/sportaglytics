import React, { useCallback, useState } from 'react';
import { Box, Stack, useTheme } from '@mui/material';
import { CreatePackageWizard } from './VideoPathSelector/CreatePackageWizard';
import { AudioSyncBackdrop } from './VideoPathSelector/AudioSyncBackdrop';
import {
  PackageLoadResult,
  VideoPathSelectorProps,
} from './VideoPathSelector/types';
import { useAudioSync } from './VideoPathSelector/hooks/useAudioSync';
import { useDragAndDrop } from './VideoPathSelector/hooks/useDragAndDrop';
import { usePackageDropLoader } from './VideoPathSelector/hooks/usePackageDropLoader';
import { useRecentPackages } from './VideoPathSelector/hooks/useRecentPackages';
import { useRecentPackageRegistration } from './VideoPathSelector/hooks/useRecentPackageRegistration';
import { useNotification } from '../../../../contexts/NotificationContext';
import { ONBOARDING_STORAGE_KEY } from '../../../../components/OnboardingTutorial';
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
  const registerRecentPackage = useRecentPackageRegistration({
    addRecentPackage,
  });
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

      if (packagePath) {
        void registerRecentPackage({
          videoList,
          syncData,
          timelinePath,
          metaDataConfigFilePath,
          packagePath,
        });
      }
    },
    [
      setIsFileSelected,
      setMetaDataConfigFilePath,
      setPackagePath,
      setSyncData,
      setTimelineFilePath,
      setVideoList,
      registerRecentPackage,
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

  const { handlePackageDrop } = usePackageDropLoader({
    onPackageLoaded: handlePackageLoaded,
  });

  const { dragState, handlers } = useDragAndDrop(handlePackageDrop);
  const theme = useTheme();

  // 最近のパッケージから開く
  const handleRecentPackageOpen = useCallback(
    (path: string) => {
      void handlePackageDrop(path);
    },
    [handlePackageDrop],
  );

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
