import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { ActionLink } from '../../../../types/Settings';
import { LINK_TYPE_LABELS } from './types';

type LinkOption = {
  value: string;
  label: string;
  group: string;
};

interface LinkEditorDialogProps {
  open: boolean;
  editingLink: ActionLink | null;
  allOptions: LinkOption[];
  formFrom: string;
  formTo: string;
  formType: ActionLink['type'];
  formDescription: string;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormFromChange: (value: string) => void;
  onFormToChange: (value: string) => void;
  onFormTypeChange: (value: ActionLink['type']) => void;
  onFormDescriptionChange: (value: string) => void;
}

export const LinkEditorDialog = ({
  open,
  editingLink,
  allOptions,
  formFrom,
  formTo,
  formType,
  formDescription,
  canSave,
  onClose,
  onSave,
  onFormFromChange,
  onFormToChange,
  onFormTypeChange,
  onFormDescriptionChange,
}: LinkEditorDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingLink ? 'リンクを編集' : '新しいリンクを追加'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>リンク元</InputLabel>
            <Select
              value={formFrom}
              label="リンク元"
              onChange={(event) => onFormFromChange(event.target.value)}
            >
              {allOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Typography variant="body2">
                    {option.label}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      ({option.group})
                    </Typography>
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>リンク先</InputLabel>
            <Select
              value={formTo}
              label="リンク先"
              onChange={(event) => onFormToChange(event.target.value)}
            >
              {allOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Typography variant="body2">
                    {option.label}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      ({option.group})
                    </Typography>
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>リンクタイプ</InputLabel>
            <Select
              value={formType}
              label="リンクタイプ"
              onChange={(event) =>
                onFormTypeChange(event.target.value as ActionLink['type'])
              }
            >
              <MenuItem value="exclusive">{LINK_TYPE_LABELS.exclusive}</MenuItem>
              <MenuItem value="deactivate">{LINK_TYPE_LABELS.deactivate}</MenuItem>
              <MenuItem value="activate">{LINK_TYPE_LABELS.activate}</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="説明（任意）"
            value={formDescription}
            onChange={(event) => onFormDescriptionChange(event.target.value)}
            placeholder="このリンクの説明"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={onSave} variant="contained" disabled={!canSave}>
          {editingLink ? '更新' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
