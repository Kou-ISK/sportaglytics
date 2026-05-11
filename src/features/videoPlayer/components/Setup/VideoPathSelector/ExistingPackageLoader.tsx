import React from 'react';
import { Button } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { PackageLoadResult } from './types';
import { useExistingPackageLoaderController } from './hooks/useExistingPackageLoaderController';

interface ExistingPackageLoaderProps {
  onPackageLoaded: (result: PackageLoadResult) => void;
}

export const ExistingPackageLoader: React.FC<ExistingPackageLoaderProps> = ({
  onPackageLoaded,
}) => {
  const { handleSelectPackage } = useExistingPackageLoaderController({
    onPackageLoaded,
  });

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
