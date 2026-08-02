import React from 'react';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import type { VideoPathSelectorProps } from './VideoPathSelector/types';
import { useVideoPathSelectorController } from './VideoPathSelector/hooks/useVideoPathSelectorController';

export const VideoPathSelector: React.FC<VideoPathSelectorProps> = ({
  openWizardRequestKey,
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
  setMediaAngles,
}) => {
  const {
    handlePackageCreated,
    handlePackageLoaded,
    handleOpenWizard,
    handleCloseWizard,
    handleRecentPackageOpen,
    removeRecentPackage,
    ...viewProps
  } = useVideoPathSelectorController({
    openWizardRequestKey,
    setVideoList,
    setIsFileSelected,
    setTimelineFilePath,
    setPackagePath,
    setMetaDataConfigFilePath,
    setSyncData,
    setMediaAngles,
  });

  return (
    <VideoPathSelectorView
      {...viewProps}
      onPackageLoaded={handlePackageLoaded}
      onOpenWizard={handleOpenWizard}
      onCloseWizard={handleCloseWizard}
      onPackageCreated={handlePackageCreated}
      onOpenRecentPackage={handleRecentPackageOpen}
      onRemoveRecentPackage={removeRecentPackage}
    />
  );
};
