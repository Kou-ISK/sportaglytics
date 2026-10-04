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
import type { HotkeyConfig } from '../../../types/settings/coreTypes';

interface HotkeySettingsListItemProps {
  hotkey: HotkeyConfig;
  shortcutLabel?: string;
  isEditing: boolean;
  capturedKey: string;
  conflictWarning: string | null;
  onEditStart: (hotkey: HotkeyConfig) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const HotkeySettingsListItem = ({
  hotkey,
  shortcutLabel = hotkey.key,
  isEditing,
  capturedKey,
  conflictWarning,
  onEditStart,
  onEditSave,
  onEditCancel,
}: HotkeySettingsListItemProps): React.ReactElement => {
  return (
    <ListItem
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        minHeight: 36,
        py: 0.25,
        px: 1.25,
      }}
    >
      <ListItemText
        primary={hotkey.label}
        slotProps={{
          primary: { variant: 'body2' },
          secondary: { component: 'div' },
        }}
        secondary={
          isEditing ? (
            <Box sx={{ mt: 1 }}>
              <Paper
                sx={{
                  p: 1.5,
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
          ) : undefined
        }
      />
      {!isEditing && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: '0 0 auto',
          }}
        >
          <Chip label={shortcutLabel} size="small" variant="outlined" />
          <Button
            size="small"
            variant="text"
            onClick={() => onEditStart(hotkey)}
          >
            変更
          </Button>
        </Box>
      )}
    </ListItem>
  );
};
