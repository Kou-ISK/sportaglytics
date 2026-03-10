import React from 'react';
import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export const FreeCanvasEmptyState = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        color: 'text.disabled',
      }}
    >
      <AddIcon sx={{ fontSize: 48, opacity: 0.5 }} />
      <Typography variant="body2">
        空白を右クリック → ボタンを追加
      </Typography>
      <Typography
        variant="caption"
        display="block"
        sx={{ mt: 1, whiteSpace: 'pre-line' }}
      >
        {`リンク作成（Sportscode準拠）:
右クリックドラッグ → 排他リンク（赤）
Option + 右クリックドラッグ → 活性化（緑）
Shift + 右クリックドラッグ → 非活性化（橙）`}
      </Typography>
    </Box>
  );
};
