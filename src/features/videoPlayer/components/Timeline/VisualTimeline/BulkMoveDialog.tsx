import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import type { ActionDefinition } from '../../../../../types/Settings';

interface BulkMoveDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (team: string, action: string) => void;
  teamNames: string[];
  actions: ActionDefinition[];
  selectedCount: number;
}

export const BulkMoveDialog: React.FC<BulkMoveDialogProps> = ({
  open,
  onClose,
  onSubmit,
  teamNames,
  actions,
  selectedCount,
}) => {
  const [team, setTeam] = useState('');
  const [action, setAction] = useState('');

  const isReady = useMemo(() => team !== '' && action !== '', [team, action]);

  const handleSubmit = () => {
    if (!isReady) return;
    onSubmit(team, action);
    setTeam('');
    setAction('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>選択した{selectedCount}件を移動</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            移動先のチームとアクションを選択してください。
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>チーム</InputLabel>
            <Select
              value={team}
              label="チーム"
              onChange={(e) => setTeam(e.target.value)}
            >
              {teamNames.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>アクション</InputLabel>
            <Select
              value={action}
              label="アクション"
              onChange={(e) => setAction(e.target.value)}
            >
              {actions.map((a) => (
                <MenuItem key={a.action} value={a.action}>
                  {a.action}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isReady}>
          移動
        </Button>
      </DialogActions>
    </Dialog>
  );
};
