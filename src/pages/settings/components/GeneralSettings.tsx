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
  TextField,
} from '@mui/material';
import type { AppSettings, ThemeMode } from '../../../types/Settings';
import { useThemeMode } from '../../../contexts/ThemeModeContext';
import type { SettingsTabHandle } from '../../SettingsPage';

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
  const [savedOverlayClip, setSavedOverlayClip] = useState<AppSettings['overlayClip']>(
    settings.overlayClip,
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () =>
      themeMode !== savedThemeMode ||
      JSON.stringify(overlayClip) !== JSON.stringify(savedOverlayClip),
  }));

  const handleSave = async () => {
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
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        一般設定
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {/* テーマモード */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">テーマモード</FormLabel>
        <RadioGroup
          value={themeMode}
          onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
        >
          <FormControlLabel
            value="light"
            control={<Radio />}
            label="ライトモード"
          />
          <FormControlLabel
            value="dark"
            control={<Radio />}
            label="ダークモード"
          />
          <FormControlLabel
            value="system"
            control={<Radio />}
            label="システム設定に従う"
          />
        </RadioGroup>
      </FormControl>

      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" gutterBottom>
        クリップ書き出しオーバーレイ
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={overlayClip.enabled}
              onChange={(e) =>
                setOverlayClip((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
          }
          label="オーバーレイを有効にする"
        />
        <Stack direction="row" spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={overlayClip.showActionName}
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
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={overlayClip.showLabels}
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
                checked={overlayClip.showQualifier}
                onChange={(e) =>
                  setOverlayClip((prev) => ({
                    ...prev,
                    showQualifier: e.target.checked,
                  }))
                }
              />
            }
            label="メモ (qualifier) を表示"
          />
        </Stack>
        <TextField
          label="テキストテンプレート"
          helperText="{actionName} {index} {labels} {qualifier} を組み合わせて表示します"
          value={overlayClip.textTemplate}
          onChange={(e) =>
            setOverlayClip((prev) => ({ ...prev, textTemplate: e.target.value }))
          }
          fullWidth
          size="small"
        />
      </Stack>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          設定を保存しました
        </Alert>
      )}

      <Button variant="contained" onClick={handleSave} fullWidth>
        保存
      </Button>
    </Box>
  );
});

GeneralSettings.displayName = 'GeneralSettings';
