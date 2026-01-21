import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

type FreeCanvasCustomActionDialogProps = {
  open: boolean;
  actionName: string;
  onActionNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export const FreeCanvasCustomActionDialog = ({
  open,
  actionName,
  onActionNameChange,
  onClose,
  onConfirm,
}: FreeCanvasCustomActionDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth={false}
      PaperProps={{ sx: { width: 420, maxWidth: '90vw' } }}
    >
      <DialogTitle>カスタムアクションを追加</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="アクション名"
          value={actionName}
          onChange={(event) => onActionNameChange(event.target.value)}
          placeholder="例: Cross, Tackle, Header"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          disabled={!actionName.trim()}
          onClick={onConfirm}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
};
