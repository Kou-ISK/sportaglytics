import { Box, CircularProgress, Typography } from '@mui/material';
import type { TimelineWindowController } from '../hooks/useTimelineWindowController';
import { AngleSyncTransportView } from './AngleSyncTransportView';
import { TimelineActionSection } from './TimelineActionSection';

interface TimelineWindowViewProps {
  controller: TimelineWindowController | null;
}

export const TimelineWindowView = ({ controller }: TimelineWindowViewProps) => {
  if (!controller) {
    return (
      <Box sx={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">タイムラインを同期中…</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100vh',
        minHeight: 0,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {controller.angleSync && (
        <AngleSyncTransportView
          state={controller.angleSync}
          time={controller.currentTime}
          playing={controller.isPlaying}
          onSeek={(time) =>
            controller.handleCurrentTime(new Event('sync-seek'), time)
          }
          onCommand={controller.onAngleSyncCommand}
        />
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TimelineActionSection {...controller} />
      </Box>
    </Box>
  );
};
