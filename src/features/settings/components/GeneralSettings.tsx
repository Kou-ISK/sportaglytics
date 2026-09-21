import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Typography,
  Alert,
  Stack,
  Paper,
} from '@mui/material';
import type { AppSettings, ThemeMode } from '../../../types/settings/coreTypes';
import { useThemeMode } from '../../../contexts/ThemeModeContext';
import type { SettingsTabHandle } from '../types';

interface GeneralSettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const GeneralSettings = forwardRef<
  SettingsTabHandle,
  GeneralSettingsProps
>(({ settings, onSave }, ref) => {
  const { setThemeMode: setContextThemeMode } = useThemeMode();
  const [themeMode, setThemeMode] = useState<ThemeMode>(settings.themeMode);
  const [savedThemeMode, setSavedThemeMode] = useState<ThemeMode>(
    settings.themeMode,
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const hasUnsavedChanges = themeMode !== savedThemeMode;

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => hasUnsavedChanges,
  }));

  const handleSave = async (): Promise<void> => {
    const newSettings: AppSettings = {
      ...settings,
      themeMode,
    };

    const success = await onSave(newSettings);
    if (success) {
      // 保存成功時に savedThemeMode を更新
      setSavedThemeMode(themeMode);

      // Context にも反映してリアルタイムで切り替わる
      setContextThemeMode(themeMode);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6">一般</Typography>
        <Typography variant="body2" color="text.secondary">
          アプリの外観を設定します。
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">外観</FormLabel>
          <RadioGroup
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            sx={{ mt: 0.5 }}
          >
            <FormControlLabel
              value="light"
              control={<Radio />}
              label="ライト"
            />
            <FormControlLabel value="dark" control={<Radio />} label="ダーク" />
            <FormControlLabel
              value="system"
              control={<Radio />}
              label="システム設定に従う"
            />
          </RadioGroup>
        </FormControl>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        映像にノートなどのテキストを含めるかは、書き出しのたびに確認します。
      </Typography>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
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

GeneralSettings.displayName = 'GeneralSettings';
