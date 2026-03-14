import React, { useMemo } from 'react';
import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { TimelineData } from '../../../../../../types/TimelineData';

interface DrilldownDialogProps {
  detail: { title: string; entries: TimelineData[] } | null;
  onClose: () => void;
  onJump: (entry: TimelineData) => void;
}

const getDuration = (entry: TimelineData) =>
  Math.max(0, entry.endTime - entry.startTime);

const formatHms = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

export const DrilldownDialog = ({
  detail,
  onClose,
  onJump,
}: DrilldownDialogProps) => {
  if (!detail) return null;
  const totalDuration = useMemo(
    () => detail.entries.reduce((sum, entry) => sum + getDuration(entry), 0),
    [detail.entries],
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {detail.title}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            件数: {detail.entries.length}件 ・ 合計時間: {formatHms(totalDuration)}
          </Typography>
          {detail.entries.map((entry, index) => {
            const actionParts = entry.actionName.split(' ');
            const team = actionParts[0];
            const action = actionParts.slice(1).join(' ');
            const startLabel = formatHms(entry.startTime);
            const endLabel = formatHms(entry.endTime);
            const durationLabel = formatHms(getDuration(entry));
            return (
              <Paper
                key={`${entry.id}-${index}`}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {team} / {action || entry.actionName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {startLabel} - {endLabel}（{durationLabel}）
                    </Typography>
                    {entry.labels && entry.labels.length > 0 && (
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                      >
                        {entry.labels.map((label) => (
                          <Chip
                            key={`${label.group}-${label.name}`}
                            size="small"
                            label={`${label.group}: ${label.name}`}
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>

                  <Tooltip title="この場面を再生">
                    <IconButton
                      color="primary"
                      aria-label="この場面を再生"
                      onClick={() => onJump(entry)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            );
          })}

          {detail.entries.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              この組み合わせに該当するタイムラインはありません。
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
