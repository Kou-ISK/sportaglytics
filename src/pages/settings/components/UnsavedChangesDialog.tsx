import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface UnsavedChangesDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  onCancel,
  onConfirm,
}) => (
  <Dialog open={open} onClose={onCancel}>
    <DialogTitle>保存されていません</DialogTitle>
    <DialogContent>
      <DialogContentText>
        保存されていない変更があります。タブを切り替えると変更が破棄されますが、よろしいですか?
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel}>キャンセル</Button>
      <Button onClick={onConfirm} color="error" autoFocus>
        破棄して移動
      </Button>
    </DialogActions>
  </Dialog>
);
