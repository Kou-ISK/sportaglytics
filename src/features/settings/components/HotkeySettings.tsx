import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  List,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { AppSettings } from '../../../types/settings/coreTypes';
import type { SettingsTabHandle } from '../types';
import { HotkeySettingsListItem } from './HotkeySettingsListItem';
import { DEFAULT_HOTKEYS } from './hotkeySettings.constants';
import { useHotkeySettingsController } from './useHotkeySettingsController';
import { useHotkeySettingsSave } from './useHotkeySettingsSave';

interface HotkeySettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const HotkeySettings = forwardRef<
  SettingsTabHandle,
  HotkeySettingsProps
>(({ settings, onSave }, ref) => {
  const [query, setQuery] = useState('');
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
  const handleSave = useHotkeySettingsSave({
    settings,
    hotkeys,
    onSave,
    markSaved,
    setSaveSuccess,
  });
  const filteredHotkeys = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return hotkeys;
    return hotkeys.filter((hotkey) =>
      `${hotkey.label} ${hotkey.key}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [hotkeys, query]);

  useImperativeHandle(
    ref,
    () => ({
      hasUnsavedChanges: () => hasUnsavedChanges,
    }),
    [hasUnsavedChanges],
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6">ホットキー</Typography>
        <Typography variant="body2" color="text.secondary">
          再生や編集に使うキーボードショートカットを変更します。
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          size="small"
          fullWidth
          label="ホットキーを検索"
          placeholder="機能名またはキー"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="outlined"
          onClick={handleResetToDefaults}
          sx={{ flex: '0 0 auto' }}
        >
          初期値に戻す
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {filteredHotkeys.length} / {hotkeys.length} 件
      </Typography>

      <List disablePadding aria-label="ホットキー一覧">
        {filteredHotkeys.map((hotkey) => (
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
      {filteredHotkeys.length === 0 && (
        <Alert severity="info">一致するホットキーはありません。</Alert>
      )}

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2, mt: 3 }}>
          設定を保存しました
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
        >
          変更を保存
        </Button>
      </Box>
    </Stack>
  );
});

HotkeySettings.displayName = 'HotkeySettings';
