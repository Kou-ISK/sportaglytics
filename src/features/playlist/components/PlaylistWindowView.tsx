import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { PlaylistWindowController } from '../hooks/playlist/usePlaylistWindowController';
import { PlaylistHeaderToolbar } from './PlaylistHeaderToolbar';
import { PlaylistItemSection } from './PlaylistItemSection';
import { PlaylistNowPlayingInfo } from './PlaylistNowPlayingInfo';
import { PlaylistVideoArea } from './PlaylistVideoArea';
import { PlaylistWindowDialogs } from './PlaylistWindowDialogs';

type PlaylistWindowViewProps = {
  controller: PlaylistWindowController;
};

export const PlaylistWindowView = ({
  controller,
}: PlaylistWindowViewProps) => {
  const theme = useTheme();

  return (
    <Box
      ref={controller.containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <PlaylistHeaderToolbar {...controller.header} />

      <PlaylistVideoArea {...controller.videoArea} />

      <PlaylistItemSection {...controller.itemSection} />

      {controller.nowPlaying ? (
        <PlaylistNowPlayingInfo {...controller.nowPlaying} />
      ) : null}

      <PlaylistWindowDialogs {...controller.dialogs} />
    </Box>
  );
};
