import React from 'react';
import { Box, Chip, Typography } from '@mui/material';

interface ButtonPlaceholderChipsProps {
  onInsertPlaceholder: (placeholder: string) => void;
}

export const ButtonPlaceholderChips = ({
  onInsertPlaceholder,
}: ButtonPlaceholderChipsProps) => {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>
        クリックで挿入:
      </Typography>
      <Chip
        label="${Team1}"
        size="small"
        variant="outlined"
        color="error"
        onClick={() => onInsertPlaceholder('${Team1}')}
        sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
      />
      <Chip
        label="${Team2}"
        size="small"
        variant="outlined"
        color="primary"
        onClick={() => onInsertPlaceholder('${Team2}')}
        sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
      />
      <Chip
        label=" "
        size="small"
        variant="outlined"
        onClick={() => onInsertPlaceholder(' ')}
        sx={{ cursor: 'pointer', minWidth: 40 }}
        title="スペースを挿入"
      />
    </Box>
  );
};
