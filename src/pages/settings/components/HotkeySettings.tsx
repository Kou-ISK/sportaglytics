import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  Box,
  Button,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Chip,
  Paper,
} from '@mui/material';
import type { AppSettings, HotkeyConfig } from '../../../types/Settings';
import type { SettingsTabHandle } from '../../SettingsPage';

interface HotkeySettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

/**
 * デフォルトのホットキー定義
 */
const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  { id: 'resync-audio', label: '音声同期を再実行', key: 'Command+Shift+S' },
  { id: 'reset-sync', label: '同期をリセット', key: 'Command+Shift+R' },
  { id: 'manual-sync', label: '今の位置で同期', key: 'Command+Shift+M' },
  { id: 'toggle-manual-mode', label: '手動モード切替', key: 'Command+Shift+T' },
  { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
  { id: 'undo', label: '元に戻す', key: 'Command+Z' },
  { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
  { id: 'skip-forward-small', label: '0.5秒進む', key: 'Right' },
  { id: 'skip-forward-medium', label: '2秒進む', key: 'Shift+Right' },
  { id: 'skip-forward-large', label: '4秒進む', key: 'Command+Right' },
  { id: 'skip-forward-xlarge', label: '6秒進む', key: 'Option+Right' },
  { id: 'skip-backward-medium', label: '5秒戻る', key: 'Left' },
  { id: 'skip-backward-large', label: '10秒戻る', key: 'Shift+Left' },
  { id: 'play-pause', label: '再生/一時停止', key: 'Space' },
  { id: 'toggle-angle1', label: 'アングル1切替', key: 'Shift+1' },
  { id: 'toggle-angle2', label: 'アングル2切替', key: 'Shift+2' },
];

/**
 * システムホットキーやアプリ標準のホットキー（衝突しやすいもの）
 */
const FORBIDDEN_HOTKEYS = new Set([
  'Command+Q', // アプリ終了
  'Command+W', // ウィンドウを閉じる
  'Command+N', // 新規ウィンドウ
  'Command+T', // 新規タブ
  'Command+C', // コピー
  'Command+V', // ペースト
  'Command+X', // カット
  'Command+A', // 全選択
  'Command+S', // 保存
  'Command+O', // 開く
  'Command+P', // 印刷
  'Command+F', // 検索
  'Command+H', // ウィンドウを隠す
  'Command+M', // 最小化
  'Command+Tab', // アプリ切り替え
  'Command+Space', // Spotlight
  'Control+Space', // 入力ソース切り替え
]);

/**
 * キーボードイベントから表示用のキー文字列を生成
 */
const formatKeyCombo = (event: KeyboardEvent): string => {
  const keys: string[] = [];

  if (event.metaKey) keys.push('Command');
  if (event.ctrlKey) keys.push('Control');
  if (event.altKey) keys.push('Option');
  if (event.shiftKey) keys.push('Shift');

  // 修飾キー以外のキー
  if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    const keyName =
      event.key.length === 1 ? event.key.toUpperCase() : event.key;
    keys.push(keyName);
  }

  return keys.join('+');
};

/**
 * ホットキーが禁止リストに含まれているかチェック
 */
const isForbiddenHotkey = (keyCombo: string): boolean => {
  return FORBIDDEN_HOTKEYS.has(keyCombo);
};

export const HotkeySettings = forwardRef<
  SettingsTabHandle,
  HotkeySettingsProps
>(({ settings, onSave }, ref) => {
  // 初期化: 既存設定がなければデフォルトを使用
  const initialHotkeys =
    settings.hotkeys.length > 0 ? settings.hotkeys : DEFAULT_HOTKEYS;
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(initialHotkeys);
  const [savedHotkeys, setSavedHotkeys] =
    useState<HotkeyConfig[]>(initialHotkeys);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capturedKey, setCapturedKey] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () =>
      JSON.stringify(hotkeys) !== JSON.stringify(savedHotkeys),
  }));

  // キーボードイベントをキャプチャ
  useEffect(() => {
    if (editingId === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Escapeキーでキャンセル
      if (event.key === 'Escape') {
        handleEditCancel();
        return;
      }

      // 修飾キーのみの場合は無視
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        return;
      }

      const keyCombo = formatKeyCombo(event);
      setCapturedKey(keyCombo);

      // 衝突チェック
      if (isForbiddenHotkey(keyCombo)) {
        setConflictWarning(
          `"${keyCombo}" はシステムで使用されているため設定できません`,
        );
      } else {
        const duplicate = hotkeys.find(
          (h) => h.key === keyCombo && h.id !== editingId,
        );
        if (duplicate) {
          setConflictWarning(
            `"${keyCombo}" は既に「${duplicate.label}」に割り当てられています`,
          );
        } else {
          setConflictWarning(null);
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingId, hotkeys]);

  const handleEditStart = (hotkey: HotkeyConfig) => {
    setEditingId(hotkey.id);
    setCapturedKey(hotkey.key);
    setConflictWarning(null);
  };

  const handleEditSave = () => {
    if (!editingId || !capturedKey || conflictWarning) return;

    setHotkeys(
      hotkeys.map((h) => (h.id === editingId ? { ...h, key: capturedKey } : h)),
    );
    setEditingId(null);
    setCapturedKey('');
    setConflictWarning(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setCapturedKey('');
    setConflictWarning(null);
  };

  const handleResetToDefaults = () => {
    setHotkeys(DEFAULT_HOTKEYS);
  };

  const handleSave = async () => {
    const newSettings: AppSettings = {
      ...settings,
      hotkeys,
    };

    const success = await onSave(newSettings);
    if (success) {
      // 保存成功時に savedHotkeys を更新
      setSavedHotkeys(hotkeys);

      // ホットキーが更新されたことをメインプロセスに通知
      const api = globalThis.window.electronAPI;
      if (api && 'send' in api) {
        (api as { send: (channel: string) => void }).send('hotkeys-updated');
      }

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
          <ListItem
            key={hotkey.id}
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
                editingId === hotkey.id ? (
                  <Box sx={{ mt: 1 }}>
                    <Paper
                      sx={{
                        p: 2,
                        mb: 1,
                        bgcolor: 'action.hover',
                        border: '2px dashed',
                        borderColor: conflictWarning
                          ? 'error.main'
                          : 'primary.main',
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
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
                        onClick={handleEditSave}
                        disabled={!capturedKey || !!conflictWarning}
                        fullWidth
                      >
                        保存
                      </Button>
                      <Button size="small" onClick={handleEditCancel} fullWidth>
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
                    <Button
                      size="small"
                      onClick={() => handleEditStart(hotkey)}
                    >
                      変更
                    </Button>
                  </Box>
                )
              }
            />
          </ListItem>
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
});

HotkeySettings.displayName = 'HotkeySettings';
