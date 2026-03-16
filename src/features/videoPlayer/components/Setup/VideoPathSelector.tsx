import React from 'react';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import type { VideoPathSelectorProps } from './VideoPathSelector/types';
import { useVideoPathSelectorController } from './VideoPathSelector/hooks/useVideoPathSelectorController';

export const VideoPathSelector: React.FC<VideoPathSelectorProps> = ({
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
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
    setVideoList,
    setIsFileSelected,
    setTimelineFilePath,
    setPackagePath,
    setMetaDataConfigFilePath,
    setSyncData,
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
