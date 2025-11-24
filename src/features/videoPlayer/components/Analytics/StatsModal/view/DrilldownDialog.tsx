import React from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TimelineData } from '../../../../../../types/TimelineData';

interface DrilldownDialogProps {
  detail: { title: string; entries: TimelineData[] } | null;
  onClose: () => void;
  onJump: (entry: TimelineData) => void;
}

export const DrilldownDialog = ({
  detail,
  onClose,
  onJump,
}: DrilldownDialogProps) => {
  if (!detail) return null;

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
          {detail.entries.map((entry, index) => {
            const actionParts = entry.actionName.split(' ');
            const team = actionParts[0];
            const action = actionParts.slice(1).join(' ');
            return (
              <Paper
                key={`${entry.id}-${index}`}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {team}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      アクション: {action}
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
                    <Typography variant="body2" color="text.secondary">
                      {entry.startTime.toFixed(1)}s - {entry.endTime.toFixed(1)}
                      s
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onJump(entry)}
                  >
                    この場面を再生
                  </Button>
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
