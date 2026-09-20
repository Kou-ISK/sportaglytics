import type { ReactElement } from 'react';
import { Box, Typography } from '@mui/material';
import type { AngleSyncSnapshot } from '../../../../../types/ipc/angleSync';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from './domain/timelineCoordinateMapper';

export const TimelineAngleTracksView = ({
  state,
  timeToPosition,
}: {
  state: AngleSyncSnapshot;
  timeToPosition: (time: number) => number;
}): ReactElement => (
  <Box
    aria-label="アングルの映像配置"
    onMouseDown={(event) => event.stopPropagation()}
  >
    {state.angles.map((angle, index) => (
      <Box
        key={index}
        data-angle-track={index}
        sx={{
          height: 28,
          display: 'flex',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: TIMELINE_ROW_HEADER_WIDTH_PX,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: (theme) => theme.custom.zIndex.timelineRowHeader,
            bgcolor:
              state.selected === index ? 'action.selected' : 'background.paper',
            overflow: 'hidden',
            px: 1,
            boxSizing: 'border-box',
          }}
        >
          <Typography variant="caption" noWrap sx={{ lineHeight: '28px' }}>
            {index + 1} · {angle.name}
            {angle.point !== null ? ' ◆' : ''}
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            bgcolor: (theme) => theme.custom.tokens.media.surface,
          }}
        >
          {angle.clips.map((clip, i) => (
            <Box
              key={i}
              data-angle-clip={i}
              title={`${angle.name} / ${i + 1}`}
              sx={{
                position: 'absolute',
                left: timeToPosition(Math.max(0, clip.start)),
                width: Math.max(
                  0,
                  timeToPosition(clip.end) -
                    timeToPosition(Math.max(0, clip.start)),
                ),
                top: 3,
                bottom: 3,
                bgcolor: 'primary.main',
                opacity:
                  state.selected === null || state.selected === index
                    ? 0.8
                    : 0.4,
                border: 1,
                borderColor: 'divider',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{ px: 0.5, color: 'primary.contrastText', fontSize: 10 }}
              >
                {i + 1}
              </Typography>
            </Box>
          ))}
          {angle.point !== null && (
            <Box
              aria-label={`${angle.name}の同期点`}
              sx={{
                position: 'absolute',
                left: timeToPosition(angle.point),
                transform: 'translateX(-50%)',
                color: 'text.primary',
                top: 1,
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              ◆
            </Box>
          )}
        </Box>
      </Box>
    ))}
  </Box>
);
