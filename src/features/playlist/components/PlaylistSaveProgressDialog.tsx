import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

type SaveProgress = {
  current: number;
  total: number;
};

type PlaylistSaveProgressDialogProps = {
  open: boolean;
  progress: SaveProgress | null;
};

export const PlaylistSaveProgressDialog = ({
  open,
  progress,
}: PlaylistSaveProgressDialogProps) => {
  return (
    <Dialog open={open} disableEscapeKeyDown>
      <DialogTitle>プレイリストを保存中</DialogTitle>
      <DialogContent sx={{ minWidth: 300 }}>
        <Stack spacing={2}>
          <Typography variant="body2">
            動画クリップを生成しています...
          </Typography>
          {progress && (
            <>
              <Typography variant="caption" color="text.secondary">
                {progress.current} / {progress.total} アイテム
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(progress.current / progress.total) * 100}
              />
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
