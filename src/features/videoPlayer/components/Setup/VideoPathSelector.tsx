import type { SportscodeBundleSelection } from '../../../../shared/timeline/sportscodeImport';
import { pickSportscodeBundle } from './SportscodeImport/gateway/sportscodeImportGateway';
import React, { useCallback, useState } from 'react';
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
  const [bundle, setBundle] = useState<SportscodeBundleSelection | null>(null);
  const onOpenBundle = useCallback(async (path: string): Promise<void> => {
    const selected = await pickSportscodeBundle(path);
    if (selected) {
      setBundle(selected);
      setSportscodeOpen(true);
    }
  }, []);
  const {
    handlePackageCreated,
    handleOpenPackage,
    handleOpenWizard,
    handleCloseWizard,
    handleRecentPackageOpen,
    removeRecentPackage,
    ...viewProps
  } = useVideoPathSelectorController({
    onOpenBundle,
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
        onOpenSportscode={() => {
          setBundle(null);
          setSportscodeOpen(true);
        }}
      />
      <SportscodeImportDialog
        open={sportscodeOpen}
        initialBundle={bundle}
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
