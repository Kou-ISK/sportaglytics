import React, { useCallback, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface TimelineAxisProps {
  axisRef: React.RefObject<HTMLDivElement>;
  maxSec: number;
  currentTimePosition: number;
  contentWidth: number;
  zoomScale: number;
  timeMarkers: number[];
  timeToPosition: (time: number) => number;
  positionToTime: (px: number) => number;
  onSeek: (time: number) => void;
  formatTime: (seconds: number) => string;
}

export const TimelineAxis: React.FC<TimelineAxisProps> = ({
  axisRef,
  maxSec,
  currentTimePosition,
  contentWidth,
  zoomScale,
  timeMarkers,
  timeToPosition,
  positionToTime,
  onSeek,
  formatTime,
}) => {
  const theme = useTheme();
  const LABEL_WIDTH = 120;
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  // 軸の幅（TimelineLaneと同じ計算）
  const axisWidth = contentWidth * zoomScale;

  const handleSeekFromMouseEvent = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const container = axisRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickX = Math.max(
        0,
        Math.min(event.clientX - rect.left, axisWidth),
      );
      const time = positionToTime(clickX);
      onSeek(Math.max(0, Math.min(time, maxSec)));
    },
    [axisRef, axisWidth, positionToTime, maxSec, onSeek],
  );

  const handlePlayheadMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsDraggingPlayhead(true);

      const handleMouseMove = (e: MouseEvent) => {
        if (rafIdRef.current !== null) return;

        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (!axisRef.current) return;
          const rect = axisRef.current.getBoundingClientRect();
          const clickX = Math.max(
            0,
            Math.min(e.clientX - rect.left, axisWidth),
          );
          const time = positionToTime(clickX);
          onSeek(Math.max(0, Math.min(time, maxSec)));
        });
      };

      const handleMouseUp = () => {
        setIsDraggingPlayhead(false);
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [axisRef, axisWidth, positionToTime, maxSec, onSeek],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        mb: 0,
        pt: 0.25,
        position: 'relative',
      }}
    >
      <Box sx={{ width: LABEL_WIDTH, flexShrink: 0 }} />
      <Box
        ref={axisRef}
        onClick={handleSeekFromMouseEvent}
        sx={{
          position: 'relative',
          width: `${axisWidth}px`,
          minWidth: `${axisWidth}px`,
          boxSizing: 'border-box',
          height: 16,
          backgroundColor:
            theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
          borderRadius: 1,
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
          },
        }}
      >
        {timeMarkers.map((time) => (
          <Box
            key={time}
            sx={{
              position: 'absolute',
              left: `${timeToPosition(time)}px`,
              top: 0,
              bottom: 0,
              borderLeft: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-end',
              pb: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6rem',
                transform: 'translateX(-50%)',
                color: 'text.secondary',
                userSelect: 'none',
              }}
            >
              {formatTime(time)}
            </Typography>
          </Box>
        ))}

        <Box
          onMouseDown={handlePlayheadMouseDown}
          sx={{
            position: 'absolute',
            left: `${Math.min(currentTimePosition, axisWidth - 2)}px`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: 'error.main',
            zIndex: 10,
            cursor: isDraggingPlayhead ? 'grabbing' : 'grab',
            '&:hover': {
              width: 4,
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${theme.palette.error.main}`,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
