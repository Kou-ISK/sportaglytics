import React from 'react';
import { Paper, Stack, Tooltip, Typography } from '@mui/material';
import { Brush, PauseCircle, PlayArrow } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type { PlaylistItem } from '../../../types/Playlist';
import type { ItemAnnotation } from '../../../types/Playlist';

type PlaylistNowPlayingInfoProps = {
  currentItem: PlaylistItem;
  isFrozen: boolean;
  currentIndex: number;
  totalCount: number;
  annotation?: ItemAnnotation;
};

export const PlaylistNowPlayingInfo = ({
  currentItem,
  isFrozen,
  currentIndex,
  totalCount,
  annotation,
}: PlaylistNowPlayingInfoProps) => {
  const theme = useTheme();
  const annotationCount = annotation?.objects.length ?? 0;

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: theme.palette.background.paper,
        px: 1.5,
        py: 0.75,
        borderTop: '1px solid',
        borderColor: theme.palette.divider,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {isFrozen ? (
          <PauseCircle fontSize="small" color="warning" />
        ) : (
          <PlayArrow fontSize="small" color="primary" />
        )}
        <Typography variant="body2" noWrap sx={{ flex: 1 }}>
          {currentItem.actionName}
          {currentItem.note && (
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              - {currentItem.note}
            </Typography>
          )}
        </Typography>
        {annotationCount ? (
          <Tooltip title={`描画 ${annotationCount}個`}>
            <Brush fontSize="small" sx={{ color: 'info.main' }} />
          </Tooltip>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {currentIndex + 1} / {totalCount}
        </Typography>
      </Stack>
    </Paper>
  );
};
