import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';

interface TimelineRowEditorDialogProps {
  open: boolean;
  name: string;
  color: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const TimelineRowEditorDialog = ({
  open,
  name,
  color,
  onNameChange,
  onColorChange,
  onClose,
  onSave,
}: TimelineRowEditorDialogProps): React.JSX.Element => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>行を編集</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          autoFocus
          label="行の名前"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) onSave();
          }}
          fullWidth
        />
        <TextField
          label="行の色"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': '行の色' } }}
          fullWidth
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>キャンセル</Button>
      <Button onClick={onSave} disabled={!name.trim()} variant="contained">
        保存
      </Button>
    </DialogActions>
  </Dialog>
);
