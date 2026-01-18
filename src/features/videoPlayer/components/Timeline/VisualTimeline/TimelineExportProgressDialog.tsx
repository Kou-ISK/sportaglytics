import React from 'react';
import { Dialog, DialogContent, DialogTitle, LinearProgress, Typography } from '@mui/material';

type TimelineExportProgressDialogProps = {
  open: boolean;
};

export const TimelineExportProgressDialog = ({
  open,
}: TimelineExportProgressDialogProps) => {
  if (!open) return null;

  return (
    <Dialog open keepMounted fullWidth maxWidth="xs">
      <DialogTitle>書き出し中...</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          FFmpegでクリップを書き出しています。完了までお待ちください。
        </Typography>
        <LinearProgress />
      </DialogContent>
    </Dialog>
  );
};
