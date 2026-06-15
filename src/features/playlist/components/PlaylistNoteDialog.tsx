import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Notes } from '@mui/icons-material';

type PlaylistNoteDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote: string;
  itemName: string;
};

export const PlaylistNoteDialog = ({
  open,
  onClose,
  onSave,
  initialNote,
  itemName,
}: PlaylistNoteDialogProps) => {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Notes />
          <Typography>メモを編集: {itemName}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <TextField
          multiline
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          fullWidth
          placeholder="映像出力時に表示されるメモを入力..."
          sx={{ mt: 1 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: 'block' }}
        >
          ※
          このメモはプレイリスト内でのみ有効で、タイムラインには反映されません。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(note)} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
