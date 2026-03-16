import { useCallback, useEffect, useState } from 'react';
import { useAudioSync } from './useAudioSync';
import { useDragAndDrop } from './useDragAndDrop';
import { usePackageDropLoader } from './usePackageDropLoader';
import { useRecentPackages } from './useRecentPackages';
import { useRecentPackageRegistration } from './useRecentPackageRegistration';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  isOnboardingCompleted,
} from '../../../../../../shared/onboarding/onboardingStorage';
import type {
  PackageLoadResult,
  VideoPathSelectorProps,
} from '../types';

interface VideoPathSelectorController {
  showWelcome: boolean;
  wizardOpen: boolean;
  syncStatus: ReturnType<typeof useAudioSync>['status'];
  dragState: ReturnType<typeof useDragAndDrop>['dragState'];
  dragHandlers: ReturnType<typeof useDragAndDrop>['handlers'];
  recentPackages: ReturnType<typeof useRecentPackages>['recentPackages'];
  performAudioSync: ReturnType<typeof useAudioSync>['performAudioSync'];
  handlePackageLoaded: (payload: PackageLoadResult) => void;
  handlePackageCreated: (payload: PackageLoadResult) => void;
  handleOpenWizard: () => void;
  handleCloseWizard: () => void;
  handleRecentPackageOpen: (path: string) => void;
  removeRecentPackage: ReturnType<typeof useRecentPackages>['removeRecentPackage'];
}

export const useVideoPathSelectorController = ({
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
}: VideoPathSelectorProps): VideoPathSelectorController => {
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

  useEffect(() => {
    setShowWelcome(!isOnboardingCompleted());
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
      registerRecentPackage,
      setIsFileSelected,
      setMetaDataConfigFilePath,
      setPackagePath,
      setSyncData,
      setTimelineFilePath,
      setVideoList,
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
  const { dragState, handlers: dragHandlers } = useDragAndDrop(handlePackageDrop);

  const handleRecentPackageOpen = useCallback(
    (path: string) => {
      void handlePackageDrop(path);
    },
    [handlePackageDrop],
  );

  return {
    showWelcome,
    wizardOpen,
    syncStatus,
    dragState,
    dragHandlers,
    recentPackages,
    performAudioSync,
    handlePackageLoaded,
    handlePackageCreated,
    handleOpenWizard: () => setWizardOpen(true),
    handleCloseWizard: () => setWizardOpen(false),
    handleRecentPackageOpen,
    removeRecentPackage,
  };
};
