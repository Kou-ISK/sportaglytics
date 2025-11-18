import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';

export interface TimelineEditDraft {
  id: string;
  actionName: string;
  qualifier: string;
  actionType: string;
  actionResult: string;
  startTime: string;
  endTime: string;
  originalStartTime: number;
  originalEndTime: number;
}

interface TimelineEditDialogProps {
  draft: TimelineEditDraft | null;
  open: boolean;
  onChange: (changes: Partial<TimelineEditDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export const TimelineEditDialog: React.FC<TimelineEditDialogProps> = ({
  draft,
  open,
  onChange,
  onClose,
  onDelete,
  onSave,
}) => {
  const { activeActions } = useActionPreset();

  const findActionDefinition = (actionName: string) => {
    const baseAction = actionName.split(' ').slice(1).join(' ');
    return activeActions.find((act) => act.action === baseAction);
  };
  if (!draft) {
    return null;
  }

  const actionDefinition = findActionDefinition(draft.actionName);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>アクション詳細を編集</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              label="開始秒"
              type="number"
              value={draft.startTime}
              onChange={(event) =>
                onChange({ startTime: event.target.value || '' })
              }
              fullWidth
              inputProps={{ min: 0, step: 0.1 }}
            />
            <TextField
              label="終了秒"
              type="number"
              value={draft.endTime}
              onChange={(event) =>
                onChange({ endTime: event.target.value || '' })
              }
              fullWidth
              inputProps={{ min: 0, step: 0.1 }}
            />
          </Stack>

          {actionDefinition?.types && (
            <FormControl fullWidth>
              <InputLabel>アクションタイプ</InputLabel>
              <Select
                value={draft.actionType}
                label="アクションタイプ"
                onChange={(event) =>
                  onChange({ actionType: event.target.value })
                }
              >
                <MenuItem value="">
                  <em>なし</em>
                </MenuItem>
                {actionDefinition.types.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {actionDefinition?.results && (
            <FormControl fullWidth>
              <InputLabel>結果</InputLabel>
              <Select
                value={draft.actionResult}
                label="結果"
                onChange={(event) =>
                  onChange({ actionResult: event.target.value })
                }
              >
                <MenuItem value="">
                  <em>なし</em>
                </MenuItem>
                {actionDefinition.results.map((result) => (
                  <MenuItem key={result} value={result}>
                    {result}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            margin="dense"
            label="メモ・備考"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            minRows={2}
            maxRows={6}
            value={draft.qualifier}
            onChange={(event) => onChange({ qualifier: event.target.value })}
            placeholder="任意のメモを入力してください（改行可）"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onDelete} disabled={!draft.id}>
          削除
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={onSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
