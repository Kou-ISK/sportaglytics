import React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
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
      <Card
        variant="outlined"
        sx={{
          flex: 1,
          minHeight: 150,
          bgcolor: 'background.paper',
        }}
      >
        <CardActionArea onClick={onOpenWizard} sx={{ height: '100%' }}>
          <CardContent sx={{ height: '100%', p: 2.5 }}>
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                }}
              >
                <AddIcon />
              </Box>
              <Box sx={{ mt: 'auto' }}>
                <Typography variant="h6">新規パッケージ</Typography>
                <Typography variant="body2" color="text.secondary">
                  media / teams / angles
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>

      <ExistingPackageLoader onPackageLoaded={onPackageLoaded} />
    </Stack>
  );
};
