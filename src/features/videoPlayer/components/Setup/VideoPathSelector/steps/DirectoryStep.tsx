import React from 'react';
import { Box, Button, Chip, Stack, Typography, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

interface DirectoryStepProps {
  packageName: string;
  selectedDirectory: string;
  onSelectDirectory: () => void;
}

/**
 * Step 2: 保存先ディレクトリ選択の確認表示
 */
export const DirectoryStep: React.FC<DirectoryStepProps> = ({
  packageName,
  selectedDirectory,
  onSelectDirectory,
}) => {
  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle1" fontWeight={700}>
        保存先
      </Typography>

      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: selectedDirectory ? 'success.main' : 'divider',
          borderRadius: 2,
          bgcolor: (theme) =>
            selectedDirectory
              ? alpha(theme.palette.success.main, 0.08)
              : 'background.paper',
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {selectedDirectory && <CheckCircleIcon color="success" />}
            <Typography variant="body2" color="text.secondary">
              {selectedDirectory || '未選択'}
            </Typography>
          </Stack>
          {packageName && (
            <Chip
              label={`${packageName} を作成`}
              size="small"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>
      </Box>

      <Box>
        <Button
          variant="contained"
          startIcon={<FolderOpenIcon />}
          onClick={onSelectDirectory}
        >
          選択
        </Button>
      </Box>
    </Stack>
  );
};
