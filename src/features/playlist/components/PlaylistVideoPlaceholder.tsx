import React from 'react';
import { Box, Typography } from '@mui/material';
import { PlaylistPlay } from '@mui/icons-material';

type PlaylistVideoPlaceholderProps = {
  isEmpty: boolean;
};

export const PlaylistVideoPlaceholder = ({
  isEmpty,
}: PlaylistVideoPlaceholderProps) => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <PlaylistPlay sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography color="text.secondary">
        {isEmpty ? 'プレイリストが空です' : 'ビデオソースが設定されていません'}
      </Typography>
    </Box>
  );
};
