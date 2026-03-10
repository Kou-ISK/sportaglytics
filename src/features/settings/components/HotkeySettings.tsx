import React, { forwardRef, useImperativeHandle } from 'react';
import { Alert, Box, Button, Divider, List, Typography } from '@mui/material';
import type { AppSettings } from '../../../types/Settings';
import type { SettingsTabHandle } from '../types';
import { HotkeySettingsListItem } from './HotkeySettingsListItem';
import { DEFAULT_HOTKEYS } from './hotkeySettings.constants';
import { useHotkeySettingsController } from './useHotkeySettingsController';

interface HotkeySettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const HotkeySettings = forwardRef<SettingsTabHandle, HotkeySettingsProps>(
  ({ settings, onSave }, ref) => {
    const initialHotkeys =
      settings.hotkeys.length > 0 ? settings.hotkeys : DEFAULT_HOTKEYS;
    const {
      hotkeys,
      editingId,
      capturedKey,
      conflictWarning,
      saveSuccess,
      setSaveSuccess,
      hasUnsavedChanges,
      handleEditStart,
      handleEditSave,
      handleEditCancel,
      handleResetToDefaults,
      markSaved,
    } = useHotkeySettingsController({ initialHotkeys });

    useImperativeHandle(
      ref,
      () => ({
        hasUnsavedChanges: () => hasUnsavedChanges,
      }),
      [hasUnsavedChanges],
    );

    const handleSave = async () => {
      const newSettings: AppSettings = {
        ...settings,
        hotkeys,
      };

      const success = await onSave(newSettings);
      if (success) {
        markSaved();
        const api = globalThis.window.electronAPI;
        api?.notifyHotkeysUpdated?.();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    };

    return (
      <Box sx={{ maxWidth: 800 }}>
        <Typography variant="h6" gutterBottom>
          ホットキー設定
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          各機能に割り当てるキーボードショートカットを変更できます
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Button variant="outlined" onClick={handleResetToDefaults} sx={{ mb: 2 }}>
          デフォルトに戻す
        </Button>

        <List>
          {hotkeys.map((hotkey) => (
            <HotkeySettingsListItem
              key={hotkey.id}
              hotkey={hotkey}
              isEditing={editingId === hotkey.id}
              capturedKey={capturedKey}
              conflictWarning={conflictWarning}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          ))}
        </List>

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2, mt: 3 }}>
            設定を保存しました
          </Alert>
        )}

        <Button variant="contained" onClick={handleSave} fullWidth sx={{ mt: 3 }}>
          保存
        </Button>
      </Box>
    );
  },
);

HotkeySettings.displayName = 'HotkeySettings';
