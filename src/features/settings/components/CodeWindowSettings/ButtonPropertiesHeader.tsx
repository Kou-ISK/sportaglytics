import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

type ButtonPropertiesHeaderProps = {
  onDelete: () => void;
};

export const ButtonPropertiesHeader = ({
  onDelete,
}: ButtonPropertiesHeaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        ボタンプロパティ
      </Typography>
      <Tooltip title="ボタンを削除">
        <IconButton size="small" color="error" onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
