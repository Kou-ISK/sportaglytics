import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

type CodeWindowCreateDialogProps = {
  open: boolean;
  layoutName: string;
  canvasWidth: number;
  canvasHeight: number;
  onLayoutNameChange: (value: string) => void;
  onCanvasWidthChange: (value: number) => void;
  onCanvasHeightChange: (value: number) => void;
  onClose: () => void;
  onCreate: () => void;
};

export const CodeWindowCreateDialog = ({
  open,
  layoutName,
  canvasWidth,
  canvasHeight,
  onLayoutNameChange,
  onCanvasWidthChange,
  onCanvasHeightChange,
  onClose,
  onCreate,
}: CodeWindowCreateDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>新しいコードウィンドウを作成</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="レイアウト名"
          fullWidth
          variant="outlined"
          value={layoutName}
          onChange={(event) => onLayoutNameChange(event.target.value)}
          sx={{ mt: 2 }}
        />
        <TextField
          margin="dense"
          label="幅 (px)"
          type="number"
          fullWidth
          variant="outlined"
          value={canvasWidth}
          onChange={(event) => onCanvasWidthChange(Number(event.target.value))}
          sx={{ mt: 2 }}
        />
        <TextField
          margin="dense"
          label="高さ (px)"
          type="number"
          fullWidth
          variant="outlined"
          value={canvasHeight}
          onChange={(event) => onCanvasHeightChange(Number(event.target.value))}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={onCreate}>
          作成
        </Button>
      </DialogActions>
    </Dialog>
  );
};
