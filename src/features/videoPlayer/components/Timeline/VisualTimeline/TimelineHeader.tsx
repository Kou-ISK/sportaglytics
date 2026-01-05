import React from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface TimelineHeaderProps {
  totalCount: number;
  selectedCount: number;
  onDeleteSelected: () => void;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  totalCount,
  selectedCount,
  onDeleteSelected,
}) => (
  <Box
    sx={{
      p: 2,
      pb: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      userSelect: 'none',
    }}
  >
    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
      タイムライン
    </Typography>
    <Chip label={`${totalCount}件`} size="small" color="primary" />
    {selectedCount > 0 && (
      <>
        <Chip label={`${selectedCount}件選択`} size="small" color="secondary" />
        <IconButton
          size="small"
          color="error"
          onClick={onDeleteSelected}
          aria-label="選択したタイムラインを削除"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </>
    )}
  </Box>
);
