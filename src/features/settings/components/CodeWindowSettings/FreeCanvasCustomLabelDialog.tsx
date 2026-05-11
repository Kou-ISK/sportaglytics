import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

type FreeCanvasCustomLabelDialogProps = {
  open: boolean;
  labelGroup: string;
  labelValue: string;
  onLabelGroupChange: (value: string) => void;
  onLabelValueChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export const FreeCanvasCustomLabelDialog = ({
  open,
  labelGroup,
  labelValue,
  onLabelGroupChange,
  onLabelValueChange,
  onClose,
  onConfirm,
}: FreeCanvasCustomLabelDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth={false}
      PaperProps={{ sx: { width: 420, maxWidth: '90vw' } }}
    >
      <DialogTitle>カスタムラベルを追加</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="グループ名"
          value={labelGroup}
          onChange={(event) => onLabelGroupChange(event.target.value)}
          placeholder="例: Zone, Technique, Body Part"
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          label="ラベル値"
          value={labelValue}
          onChange={(event) => onLabelValueChange(event.target.value)}
          placeholder="例: Left, Right, Center"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          disabled={!labelGroup.trim() || !labelValue.trim()}
          onClick={onConfirm}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
};
