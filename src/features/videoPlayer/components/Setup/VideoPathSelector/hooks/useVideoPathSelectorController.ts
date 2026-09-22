import { useCallback, useEffect, useState } from 'react';
import { useDragAndDrop } from './useDragAndDrop';
import { useStartPackageOpen } from './useStartPackageOpen';
import type { StartStatusProps } from '../components/StartStatusView';
import { useRecentPackages } from './useRecentPackages';
import { useRecentPackageRegistration } from './useRecentPackageRegistration';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { isOnboardingCompleted } from '../../../../../../shared/onboarding/onboardingStorage';
import type { PackageLoadResult, VideoPathSelectorProps } from '../types';

interface VideoPathSelectorController extends StartStatusProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  handleOpenPackage: () => void;
  onOpenCapture: () => void;
  showWelcome: boolean;
  wizardOpen: boolean;
  dragState: ReturnType<typeof useDragAndDrop>['dragState'];
  dragHandlers: ReturnType<typeof useDragAndDrop>['handlers'];
  recentPackages: ReturnType<typeof useRecentPackages>['recentPackages'];
  handlePackageLoaded: (payload: PackageLoadResult) => void;
  handlePackageCreated: (payload: PackageLoadResult) => void;
  handleOpenWizard: () => void;
  handleCloseWizard: () => void;
  handleRecentPackageOpen: (path: string) => void;
  removeRecentPackage: ReturnType<
    typeof useRecentPackages
  >['removeRecentPackage'];
}

export const useVideoPathSelectorController = ({
  openWizardRequestKey = 0,
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
  setMediaAngles,
}: VideoPathSelectorProps): VideoPathSelectorController => {
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const { recentPackages, addRecentPackage, removeRecentPackage } =
    useRecentPackages();
  const registerRecentPackage = useRecentPackageRegistration({
    addRecentPackage,
  });
  const { notify } = useNotification();

  useEffect(() => {
    setShowWelcome(!isOnboardingCompleted());
  }, []);

  useEffect(() => {
    if (openWizardRequestKey > 0) {
      setWizardOpen(true);
    }
  }, [openWizardRequestKey]);

  const handlePackageLoaded = useCallback(
    ({
      videoList,
      syncData,
      timelinePath,
      metaDataConfigFilePath,
      packagePath,
      mediaAngles,
    }: PackageLoadResult) => {
      setVideoList(videoList);
      setSyncData(syncData);
      setTimelineFilePath(timelinePath);
      setMetaDataConfigFilePath(metaDataConfigFilePath);
      setMediaAngles(mediaAngles ?? []);
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
      setMediaAngles,
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

  const opener = useStartPackageOpen(handlePackageLoaded);
  const { dragState, handlers: dragHandlers } = useDragAndDrop(
    (path) => void opener.open(path),
    opener.reportInvalidDrop,
    opener.busy || wizardOpen,
  );

  return {
    searchQuery,
    onSearchChange: setSearchQuery,
    busy: opener.busy,
    error: opener.error,
    errorDetails: opener.errorDetails,
    invalidDrop: opener.invalidDrop,
    onRetry: opener.retry,
    onDismissError: opener.dismissError,
    handleOpenPackage: () => void opener.open(),
    onOpenCapture: () => {
      void window.electronAPI?.liveCapture
        .open()
        .catch(() =>
          notify({
            message: 'ライブキャプチャを開けませんでした',
            severity: 'error',
          }),
        );
    },
    showWelcome,
    wizardOpen,
    dragState,
    dragHandlers,
    recentPackages,
    handlePackageLoaded,
    handlePackageCreated,
    handleOpenWizard: () => setWizardOpen(true),
    handleCloseWizard: () => setWizardOpen(false),
    handleRecentPackageOpen: (path) => void opener.open(path),
    removeRecentPackage,
  };
};
