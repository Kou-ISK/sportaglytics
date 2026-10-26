import type { ReactElement } from 'react';
import { Box } from '@mui/material';
import type { useTimelineSeek } from './hooks/useTimelineSeek';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from './domain/timelineCoordinateMapper';

interface TimelinePlayheadProps {
  position: number;
  hidden?: boolean;
  maxSec: number;
  currentTime: number;
  formatTime: (value: number) => string;
  onSeek: (time: number) => void;
  onSeekRelative?: (seconds: number) => void;
  seekHandlers: ReturnType<typeof useTimelineSeek>;
}
export const TimelinePlayhead = ({
  position,
  hidden = false,
  maxSec,
  currentTime,
  formatTime,
  onSeek,
  onSeekRelative,
  seekHandlers,
}: TimelinePlayheadProps): ReactElement => (
  <Box
    data-testid="timeline-playhead-continuous"
    sx={{
      visibility: hidden ? 'hidden' : 'visible',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: TIMELINE_ROW_HEADER_WIDTH_PX + position,
      width: 0,
      borderLeft: '1px solid',
      borderColor: 'error.main',
      pointerEvents: 'none',
      zIndex: (theme) => theme.custom.zIndex.timelinePlayheadOverlay,
    }}
  >
    <Box
      role="slider"
      aria-label="タイムラインの再生位置"
      aria-valuemin={0}
      aria-valuemax={maxSec}
      aria-valuenow={currentTime}
      aria-valuetext={formatTime(currentTime)}
      tabIndex={0}
      {...seekHandlers}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const delta = event.shiftKey ? 10 : 1;
        if (
          onSeekRelative &&
          (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        ) {
          event.preventDefault();
          event.stopPropagation();
          onSeekRelative(event.key === 'ArrowLeft' ? -delta : delta);
          return;
        }
        const value =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? maxSec
              : event.key === 'ArrowLeft'
                ? currentTime - delta
                : event.key === 'ArrowRight'
                  ? currentTime + delta
                  : null;
        if (value === null) return;
        event.preventDefault();
        event.stopPropagation();
        onSeek(Math.max(0, Math.min(maxSec, value)));
      }}
      sx={{
        position: 'sticky',
        top: 0,
        ml: '-6px',
        width: 12,
        height: 28,
        bgcolor: 'error.main',
        borderRadius: '0 0 3px 3px',
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: 'ew-resize',
      }}
    />
  </Box>
);
