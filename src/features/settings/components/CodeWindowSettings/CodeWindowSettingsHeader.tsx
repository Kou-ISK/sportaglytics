import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

type CodeWindowSettingsHeaderProps = {
  hasChanges: boolean;
  onSave: () => void;
};

export const CodeWindowSettingsHeader = ({
  hasChanges,
  onSave,
}: CodeWindowSettingsHeaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Typography variant="h6">コードウィンドウ設定</Typography>
      <Button
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={!hasChanges}
      >
        保存
      </Button>
    </Box>
  );
};
