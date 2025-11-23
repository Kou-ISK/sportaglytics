import React, { useCallback, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface TimelineAxisProps {
  containerRef: React.RefObject<HTMLDivElement>;
  maxSec: number;
  currentTimePosition: number;
  timeMarkers: number[];
  timeToPosition: (time: number) => number;
  onSeek: (time: number) => void; // マウスイベントではなく時間を直接受け取る
  formatTime: (seconds: number) => string;
}

export const TimelineAxis: React.FC<TimelineAxisProps> = ({
  containerRef,
  maxSec,
  currentTimePosition,
  timeMarkers,
  timeToPosition,
  onSeek,
  formatTime,
}) => {
  const theme = useTheme();
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  // マウスイベントから時間を計算してonSeekを呼び出す
  const handleSeekFromMouseEvent = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const time = (clickX / rect.width) * maxSec;
      onSeek(Math.max(0, Math.min(time, maxSec)));
    },
    [containerRef, maxSec, onSeek],
  );

  const handlePlayheadMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsDraggingPlayhead(true);

      const handleMouseMove = (e: MouseEvent) => {
        // requestAnimationFrameでスロットリング
        if (rafIdRef.current !== null) {
          return; // すでにフレーム処理がスケジュールされている
        }

        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;

          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const clickX = Math.max(
            0,
            Math.min(e.clientX - rect.left, rect.width),
          );
          const time = (clickX / rect.width) * maxSec;
          onSeek(Math.max(0, Math.min(time, maxSec)));
        });
      };

      const handleMouseUp = () => {
        setIsDraggingPlayhead(false);
        // クリーンアップ: 未完了のrequestAnimationFrameをキャンセル
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
    [containerRef, maxSec, onSeek],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
      }}
    >
      <Box sx={{ width: 120, flexShrink: 0 }} />

      <Box
        ref={containerRef}
        onClick={handleSeekFromMouseEvent}
        sx={{
          position: 'relative',
          flex: 1,
          height: 40,
          backgroundColor:
            theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
          borderRadius: 1,
          cursor: 'pointer',
          userSelect: 'none',
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
              pb: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
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
            left: `${currentTimePosition}px`,
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
