import React, { useState } from 'react';
import { CreatePackageWizard } from './VideoPathSelector/CreatePackageWizard';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import type { VideoPathSelectorProps } from './VideoPathSelector/types';
import { useVideoPathSelectorController } from './VideoPathSelector/hooks/useVideoPathSelectorController';
import { SportscodeImportDialog } from './SportscodeImport/SportscodeImportDialog';

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
  const [sportscodeOpen, setSportscodeOpen] = useState(false);
  const {
    handlePackageCreated,
    handleOpenPackage,
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
    <>
      <VideoPathSelectorView
        {...viewProps}
        onOpenPackage={handleOpenPackage}
        onOpenWizard={handleOpenWizard}
        onOpenRecentPackage={handleRecentPackageOpen}
        onRemoveRecentPackage={removeRecentPackage}
        onOpenSportscode={() => setSportscodeOpen(true)}
      />
      <SportscodeImportDialog
        open={sportscodeOpen}
        onClose={() => setSportscodeOpen(false)}
        onImported={handlePackageCreated}
      />
      <CreatePackageWizard
        open={viewProps.wizardOpen}
        onClose={handleCloseWizard}
        onPackageCreated={handlePackageCreated}
      />
    </>
  );
};
