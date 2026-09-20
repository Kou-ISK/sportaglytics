import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { formatSyncTime } from '../hooks/sync/clipSyncPresentation';

export interface SyncTimelineItem {
  id: string;
  angleId: string;
  angleName: string;
  name: string;
  start: number;
  duration: number;
  changed: boolean;
}
interface ClipSyncTimelineViewProps {
  clips: SyncTimelineItem[];
  referenceId: string;
  targetId: string;
  referencePoint: number;
  targetPoint: number;
  busy: boolean;
  onSelect: (clipId: string) => void;
  onMoveTarget: (seconds: number) => void;
}

export const ClipSyncTimelineView = ({
  clips,
  referenceId,
  targetId,
  referencePoint,
  targetPoint,
  busy,
  onSelect,
  onMoveTarget,
}: ClipSyncTimelineViewProps): ReactElement => {
  const [dragRange, setDragRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const pointerX = useRef(0);
  const start =
    dragRange?.start ?? Math.min(0, ...clips.map((clip) => clip.start));
  const end =
    dragRange?.end ??
    Math.max(1, ...clips.map((clip) => clip.start + clip.duration));
  const span = end - start;
  const angleIds = [...new Set(clips.map((clip) => clip.angleId))];
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        px: 1.5,
        py: 1,
      }}
    >
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" fontWeight={700}>
          クリップ配置{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            ・対象をドラッグして調整
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          変更は「同期を適用」で保存
        </Typography>
      </Stack>
      <Box
        sx={{
          ml: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {[start, start + span / 2, end].map((time) => (
          <Typography key={time} variant="caption" color="text.secondary">
            {formatSyncTime(time)}
          </Typography>
        ))}
      </Box>
      <Box sx={{ maxHeight: 144, overflowY: 'auto' }}>
        {angleIds.map((angleId) => (
          <Stack
            key={angleId}
            direction="row"
            alignItems="center"
            sx={{
              height: 36,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ width: 96, flexShrink: 0, pr: 1 }}
            >
              {clips.find((clip) => clip.angleId === angleId)?.angleName}
            </Typography>
            <Box
              sx={{
                flex: 1,
                height: '100%',
                position: 'relative',
                bgcolor: 'action.hover',
                overflow: 'hidden',
              }}
            >
              {clips
                .filter((clip) => clip.angleId === angleId)
                .map((clip) => {
                  const target = clip.id === targetId;
                  const selected = target || clip.id === referenceId;
                  return (
                    <Tooltip
                      key={clip.id}
                      title={`${clip.name} · ${formatSyncTime(clip.start)}${clip.changed ? ' · 未保存' : ''}`}
                    >
                      <ButtonBase
                        disabled={busy}
                        aria-label={`${clip.angleName} ${clip.name}の配置`}
                        aria-pressed={selected}
                        onClick={() => onSelect(clip.id)}
                        onPointerDown={(event) => {
                          if (!target || busy) return;
                          pointerX.current = event.clientX;
                          setDragRange({ start, end });
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                        }}
                        onPointerMove={(event) => {
                          if (
                            !target ||
                            !event.currentTarget.hasPointerCapture(
                              event.pointerId,
                            )
                          )
                            return;
                          const delta = event.clientX - pointerX.current;
                          pointerX.current = event.clientX;
                          const width =
                            event.currentTarget.parentElement?.clientWidth ?? 0;
                          if (width && delta)
                            onMoveTarget((delta / width) * span);
                        }}
                        onPointerUp={(event) => {
                          if (
                            event.currentTarget.hasPointerCapture(
                              event.pointerId,
                            )
                          )
                            event.currentTarget.releasePointerCapture(
                              event.pointerId,
                            );
                          setDragRange(null);
                        }}
                        onLostPointerCapture={() => setDragRange(null)}
                        sx={{
                          position: 'absolute',
                          top: 2,
                          bottom: 2,
                          left: `${((clip.start - start) / span) * 100}%`,
                          width: `${(clip.duration / span) * 100}%`,
                          minWidth: 6,
                          justifyContent: 'flex-start',
                          px: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: selected ? 'primary.main' : 'divider',
                          bgcolor: selected
                            ? 'action.selected'
                            : 'background.paper',
                          cursor: target ? 'ew-resize' : 'pointer',
                          touchAction: 'none',
                        }}
                      >
                        <Typography variant="caption" noWrap>
                          {clip.changed ? '• ' : ''}
                          {clip.name}
                        </Typography>
                      </ButtonBase>
                    </Tooltip>
                  );
                })}
              {[
                { id: referenceId, time: referencePoint },
                { id: targetId, time: targetPoint },
              ]
                .filter((point) =>
                  clips.some(
                    (clip) => clip.id === point.id && clip.angleId === angleId,
                  ),
                )
                .map((point, index) => (
                  <Box
                    key={index}
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${((point.time - start) / span) * 100}%`,
                      borderLeft: '2px solid',
                      borderColor: 'primary.main',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
            </Box>
          </Stack>
        ))}
      </Box>
    </Box>
  );
};
