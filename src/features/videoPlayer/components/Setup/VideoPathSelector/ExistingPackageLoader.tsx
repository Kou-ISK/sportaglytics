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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { PackageLoadResult } from './types';
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
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        minHeight: 150,
        bgcolor: 'background.paper',
      }}
    >
      <CardActionArea
        onClick={() => {
          void handleSelectPackage();
        }}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ height: '100%', p: 2.5 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'secondary.main',
                bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
              }}
            >
              <FolderOpenIcon />
            </Box>
            <Box sx={{ mt: 'auto' }}>
              <Typography variant="h6">開く</Typography>
              <Typography variant="body2" color="text.secondary">
                .stpkg
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
