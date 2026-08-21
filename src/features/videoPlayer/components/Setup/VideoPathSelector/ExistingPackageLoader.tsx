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
        width: '100%',
        minHeight: 132,
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
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              }}
            >
              <FolderOpenIcon />
            </Box>
            <Box>
              <Typography variant="h6">パッケージを開く</Typography>
              <Typography variant="body2" color="text.secondary">
                既存の .stpkg を選択して分析を再開します
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
