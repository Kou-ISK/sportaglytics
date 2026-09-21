import type { ReactElement, ReactNode, RefObject } from 'react';
import { Box, Typography } from '@mui/material';
import type { useTimelineSeek } from './hooks/useTimelineSeek';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from './domain/timelineCoordinateMapper';

export interface TimelineAxisProps {
  children?: ReactNode;
  seekHandlers?: ReturnType<typeof useTimelineSeek>;
  axisRef: RefObject<HTMLDivElement | null>;
  contentWidth: number;
  timeMarkers: number[];
  timeToPosition: (time: number) => number;
  formatTime: (time: number) => string;
}

export const TimelineAxis = ({
  children,
  seekHandlers,
  axisRef,
  contentWidth,
  timeMarkers,
  timeToPosition,
  formatTime,
}: TimelineAxisProps): ReactElement => (
  <Box
    data-testid="timeline-ruler"
    sx={{
      display: 'flex',
      height: 28,
      position: 'sticky',
      top: 0,
      bgcolor: 'background.paper',
      zIndex: (theme) => theme.custom.zIndex.timelineRuler,
      borderBottom: 1,
      borderColor: 'divider',
    }}
    onMouseDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <Box
      sx={{
        width: TIMELINE_ROW_HEADER_WIDTH_PX,
        flexShrink: 0,
        position: 'sticky',
        left: 0,
        bgcolor: 'background.paper',
        zIndex: (theme) => theme.custom.zIndex.timelineRowHeader,
        px: 1,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Timeline
      </Typography>
    </Box>
    <Box
      ref={axisRef}
      {...seekHandlers}
      data-testid="timeline-time-origin"
      sx={{
        width: contentWidth,
        flexShrink: 0,
        position: 'relative',
        touchAction: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {children}
      {timeMarkers.map((time) => (
        <Box
          key={time}
          sx={{
            position: 'absolute',
            left: timeToPosition(time),
            bottom: 0,
            height: 7,
            borderLeft: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="technical"
            sx={{
              position: 'absolute',
              bottom: 7,
              left: 4,
              whiteSpace: 'nowrap',
              color: 'text.secondary',
              fontSize: '0.6875rem',
              userSelect: 'none',
            }}
          >
            {formatTime(time)}
          </Typography>
        </Box>
      ))}
    </Box>
  </Box>
);
