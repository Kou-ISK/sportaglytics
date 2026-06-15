import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';

type TimelineLabelDialogProps = {
  open: boolean;
  selectedCount: number;
  labelGroup: string;
  labelName: string;
  onLabelGroupChange: (value: string) => void;
  onLabelNameChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
};

export const TimelineLabelDialog = ({
  open,
  selectedCount,
  labelGroup,
  labelName,
  onLabelGroupChange,
  onLabelNameChange,
  onClose,
  onApply,
}: TimelineLabelDialogProps) => {
  const canApply = labelGroup.trim() && labelName.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>ラベルを付与</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          選択中 {selectedCount}{' '}
          件に同じラベルを付与します。入力は次回も保持されるので連続付与が素早く行えます。
        </Typography>
        <TextField
          label="グループ"
          value={labelGroup}
          onChange={(event) => onLabelGroupChange(event.target.value)}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canApply) {
              event.preventDefault();
              onApply();
            }
          }}
        />
        <TextField
          label="ラベル名"
          value={labelName}
          onChange={(event) => onLabelNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canApply) {
              event.preventDefault();
              onApply();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={onApply} disabled={!canApply}>
          付与
        </Button>
      </DialogActions>
    </Dialog>
  );
};
