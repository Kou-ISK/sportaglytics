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
  Divider,
  Alert,
  Switch,
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
  const [overlayClip, setOverlayClip] = useState<AppSettings['overlayClip']>(
    settings.overlayClip,
  );
  const [savedThemeMode, setSavedThemeMode] = useState<ThemeMode>(
    settings.themeMode,
  );
  const [savedOverlayClip, setSavedOverlayClip] = useState<
    AppSettings['overlayClip']
  >(settings.overlayClip);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const hasUnsavedChanges =
    themeMode !== savedThemeMode ||
    JSON.stringify(overlayClip) !== JSON.stringify(savedOverlayClip);

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => hasUnsavedChanges,
  }));

  const handleSave = async (): Promise<void> => {
    const newSettings: AppSettings = {
      ...settings,
      themeMode,
      overlayClip,
    };

    const success = await onSave(newSettings);
    if (success) {
      // 保存成功時に savedThemeMode を更新
      setSavedThemeMode(themeMode);
      setSavedOverlayClip(overlayClip);

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
          外観と映像クリップの書き出し表示を設定します。
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

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography variant="subtitle1" fontWeight={600}>
          クリップ書き出しオーバーレイ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          書き出した映像にタイムライン情報を重ねます。
        </Typography>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={overlayClip.enabled}
                onChange={(e) =>
                  setOverlayClip((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
              />
            }
            label="オーバーレイを有効にする"
          />
          <Divider />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 0.5,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={overlayClip.showActionName}
                  disabled={!overlayClip.enabled}
                  onChange={(e) =>
                    setOverlayClip((prev) => ({
                      ...prev,
                      showActionName: e.target.checked,
                    }))
                  }
                />
              }
              label="アクション名を表示"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={overlayClip.showActionIndex}
                  disabled={!overlayClip.enabled}
                  onChange={(e) =>
                    setOverlayClip((prev) => ({
                      ...prev,
                      showActionIndex: e.target.checked,
                    }))
                  }
                />
              }
              label="同一行内の番号を表示"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={overlayClip.showLabels}
                  disabled={!overlayClip.enabled}
                  onChange={(e) =>
                    setOverlayClip((prev) => ({
                      ...prev,
                      showLabels: e.target.checked,
                    }))
                  }
                />
              }
              label="ラベル (グループ+名前) を表示"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={overlayClip.showMemo}
                  disabled={!overlayClip.enabled}
                  onChange={(e) =>
                    setOverlayClip((prev) => ({
                      ...prev,
                      showMemo: e.target.checked,
                    }))
                  }
                />
              }
              label="メモを表示"
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            形式: 1行目=通番+アクション名（太字）、2行目=ラベル、3行目=メモ
          </Typography>
        </Stack>
      </Paper>

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
