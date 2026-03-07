import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import type { HotkeyConfig } from '../../../types/Settings';

interface HotkeySettingsListItemProps {
  hotkey: HotkeyConfig;
  isEditing: boolean;
  capturedKey: string;
  conflictWarning: string | null;
  onEditStart: (hotkey: HotkeyConfig) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const HotkeySettingsListItem = ({
  hotkey,
  isEditing,
  capturedKey,
  conflictWarning,
  onEditStart,
  onEditSave,
  onEditCancel,
}: HotkeySettingsListItemProps) => {
  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <ListItemText
        primary={hotkey.label}
        secondary={
          isEditing ? (
            <Box sx={{ mt: 1 }}>
              <Paper
                sx={{
                  p: 2,
                  mb: 1,
                  bgcolor: 'action.hover',
                  border: '2px dashed',
                  borderColor: conflictWarning ? 'error.main' : 'primary.main',
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  キーを押してください（Escでキャンセル）
                </Typography>
                <Chip
                  label={capturedKey || 'キー入力待ち...'}
                  color={conflictWarning ? 'error' : 'primary'}
                  sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                />
              </Paper>
              {conflictWarning && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {conflictWarning}
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onEditSave}
                  disabled={!capturedKey || !!conflictWarning}
                  fullWidth
                >
                  保存
                </Button>
                <Button size="small" onClick={onEditCancel} fullWidth>
                  キャンセル
                </Button>
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1,
              }}
            >
              <Chip label={hotkey.key} size="small" />
              <Button size="small" onClick={() => onEditStart(hotkey)}>
                変更
              </Button>
            </Box>
          )
        }
      />
    </ListItem>
  );
};
