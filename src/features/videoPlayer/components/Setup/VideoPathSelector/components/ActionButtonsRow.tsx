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
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <ExistingPackageLoader
        onPackageLoaded={onPackageLoaded}
      />

      <Button
        sx={{ height: '60px', fontSize: '16px', flex: 1 }}
        onClick={onOpenWizard}
        variant="outlined"
        size="large"
        startIcon={<AddIcon />}
      >
        新規パッケージを作成
      </Button>
    </Stack>
  );
};
