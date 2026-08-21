import React from 'react';
import { Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ExistingPackageLoader } from '../ExistingPackageLoader';
import type { PackageLoadResult } from '../types';

interface ActionButtonsRowProps {
  onPackageLoaded: (payload: PackageLoadResult) => void;
  onOpenWizard: () => void;
}

export const ActionButtonsRow: React.FC<ActionButtonsRowProps> = ({
  onPackageLoaded,
  onOpenWizard,
}) => {
  return (
    <Stack spacing={1.25}>
      <ExistingPackageLoader onPackageLoaded={onPackageLoaded} />

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onOpenWizard}
        sx={{ alignSelf: 'flex-start' }}
      >
        新しいパッケージを作成
      </Button>
    </Stack>
  );
};
