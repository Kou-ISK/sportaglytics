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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import type {
  AppSettings,
  ActionPreset,
  ActionDefinition,
} from '../../../types/Settings';
import { useActionPreset } from '../../../contexts/ActionPresetContext';
import { validateActionHotkey } from '../../../utils/hotkeyValidation';
import type { SettingsTabHandle } from '../../SettingsPage';
import {
  downloadPresetsAsFile,
  importPresetsFromFile,
  resolvePresetIdConflicts,
} from '../../../utils/presetImportExport';

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

interface ActionPresetSettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const ActionPresetSettings = forwardRef<
  SettingsTabHandle,
  ActionPresetSettingsProps
>(({ settings, onSave }, ref) => {
  const {
    availablePresets,
    setActivePresetId: setContextActivePresetId,
    reloadPresets,
  } = useActionPreset();
  const [activeId, setActiveId] = useState<string>(
    settings.activePresetId || 'default',
  );
  const [presets, setPresets] = useState<ActionPreset[]>(
    settings.actionPresets,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ActionPreset | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // フォーム用の一時状態（プリセット全体）
  const [formName, setFormName] = useState('');
  const [formActions, setFormActions] = useState<ActionDefinition[]>([]);

  // アクション編集用ダイアログ
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(
    null,
  );
  const [actionFormName, setActionFormName] = useState('');
  const [actionFormGroups, setActionFormGroups] = useState<
    Array<{ groupName: string; options: string }>
  >([]);

  // ホットキー編集用の状態（HotkeySettingsと同様のパターン）
  const [editingHotkeyForAction, setEditingHotkeyForAction] = useState<
    number | null
  >(null);
  const [capturedKey, setCapturedKey] = useState('');
  const [hotkeyConflictWarning, setHotkeyConflictWarning] = useState<
    string | null
  >(null);

  // 未保存の変更を検出
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      const hasPresetsChanged =
        JSON.stringify(presets) !== JSON.stringify(settings.actionPresets);
      const hasActiveIdChanged = activeId !== settings.activePresetId;
      return hasPresetsChanged || hasActiveIdChanged;
    },
  }));

  // ホットキーキャプチャ用のイベントリスナー（HotkeySettingsと同様）
  useEffect(() => {
    if (editingHotkeyForAction === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Escapeキーでキャンセル
      if (event.key === 'Escape') {
        handleCancelHotkeyEdit();
        return;
      }

      // 修飾キーのみの場合は無視
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        return;
      }

      const keyCombo = formatKeyCombo(event);
      setCapturedKey(keyCombo);

      // 衝突チェック
      const existingHotkeys = formActions
        .map((a, idx) => (idx === editingHotkeyForAction ? null : a.hotkey))
        .filter((h): h is string => h !== undefined && h !== '');

      const validationError = validateActionHotkey(
        keyCombo,
        settings.hotkeys,
        existingHotkeys,
      );

      setHotkeyConflictWarning(validationError);
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingHotkeyForAction, formActions, settings.hotkeys]);

  const handleOpenDialog = (preset?: ActionPreset) => {
    if (preset) {
      setEditingPreset(preset);
      setFormName(preset.name);
      setFormActions([...preset.actions]);
    } else {
      setEditingPreset(null);
      setFormName('');
      setFormActions([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPreset(null);
  };

  const handleOpenActionDialog = (index?: number) => {
    if (index !== undefined && formActions[index]) {
      setEditingActionIndex(index);
      const act = formActions[index];
      setActionFormName(act.action);
      setCapturedKey(act.hotkey || '');

      // グループ構造をロード（優先）
      if (act.groups && act.groups.length > 0) {
        setActionFormGroups(
          act.groups.map((g) => ({
            groupName: g.groupName,
            options: g.options.join(', '),
          })),
        );
      } else if (act.results.length > 0 || act.types.length > 0) {
        // 旧形式の場合は自動変換
        const groups: Array<{ groupName: string; options: string }> = [];
        if (act.results.length > 0) {
          groups.push({ groupName: 'Result', options: act.results.join(', ') });
        }
        if (act.types.length > 0) {
          groups.push({ groupName: 'Type', options: act.types.join(', ') });
        }
        setActionFormGroups(groups);
      } else {
        setActionFormGroups([]);
      }
    } else {
      setEditingActionIndex(null);
      setActionFormName('');
      setCapturedKey('');
      setActionFormGroups([]);
    }
    setEditingHotkeyForAction(null);
    setHotkeyConflictWarning(null);
    setActionDialogOpen(true);
  };

  const handleStartHotkeyEdit = (actionIndex: number) => {
    setEditingHotkeyForAction(actionIndex);
    const currentHotkey = formActions[actionIndex]?.hotkey || '';
    setCapturedKey(currentHotkey);
    setHotkeyConflictWarning(null);
  };

  const handleSaveHotkeyEdit = () => {
    if (
      editingHotkeyForAction === null ||
      !capturedKey ||
      hotkeyConflictWarning
    )
      return;

    const updated = [...formActions];
    updated[editingHotkeyForAction] = {
      ...updated[editingHotkeyForAction],
      hotkey: capturedKey,
    };
    setFormActions(updated);
    setEditingHotkeyForAction(null);
    setCapturedKey('');
    setHotkeyConflictWarning(null);
  };

  const handleCancelHotkeyEdit = () => {
    const originalHotkey =
      editingHotkeyForAction === null
        ? ''
        : formActions[editingHotkeyForAction]?.hotkey || '';
    setCapturedKey(originalHotkey);
    setEditingHotkeyForAction(null);
    setHotkeyConflictWarning(null);
  };

  const handleClearHotkey = (actionIndex: number) => {
    const updated = [...formActions];
    updated[actionIndex] = {
      ...updated[actionIndex],
      hotkey: undefined,
    };
    setFormActions(updated);
  };

  const handleCloseActionDialog = () => {
    setActionDialogOpen(false);
    setEditingActionIndex(null);
  };

  const handleSaveAction = () => {
    // グループ構造を必須とする
    const groups = actionFormGroups.map((g) => ({
      groupName: g.groupName,
      options: g.options
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));

    const newAction: ActionDefinition = {
      action: actionFormName,
      results: [], // 後方互換性のため空配列で保持
      types: [], // 後方互換性のため空配列で保持
      groups: groups.length > 0 ? groups : undefined,
      hotkey: capturedKey.trim() || undefined,
    };

    if (editingActionIndex === null) {
      setFormActions([...formActions, newAction]);
    } else {
      const updated = [...formActions];
      updated[editingActionIndex] = newAction;
      setFormActions(updated);
    }

    handleCloseActionDialog();
  };

  const handleDeleteAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const handleSavePreset = () => {
    const newPreset: ActionPreset = {
      id: editingPreset?.id || `preset_${Date.now()}`,
      name: formName,
      actions: formActions,
      order: editingPreset?.order || presets.length,
      isDefault: editingPreset?.isDefault || false, // デフォルトフラグを維持
    };

    let updatedPresets: ActionPreset[];
    if (editingPreset) {
      if (editingPreset.isDefault) {
        // デフォルトプリセットの場合
        // presetsに既に存在する場合は更新、存在しない場合は追加
        const existsInPresets = presets.some((p) => p.id === editingPreset.id);
        if (existsInPresets) {
          updatedPresets = presets.map((p) =>
            p.id === editingPreset.id ? newPreset : p,
          );
        } else {
          // デフォルトプリセットを初めて編集する場合は追加
          updatedPresets = [...presets, newPreset];
        }
      } else {
        // カスタムプリセットの場合は通常更新
        updatedPresets = presets.map((p) =>
          p.id === editingPreset.id ? newPreset : p,
        );
      }
    } else {
      // 新規プリセット追加
      updatedPresets = [...presets, newPreset];
    }

    setPresets(updatedPresets);
    handleCloseDialog();
  };

  const handleDeletePreset = (id: string) => {
    // デフォルトプリセットは削除不可
    const preset = presets.find((p) => p.id === id);
    if (preset?.isDefault) return;

    setPresets(presets.filter((p) => p.id !== id));
  };

  const handleExport = () => {
    try {
      // すべてのプリセット（デフォルト含む）をエクスポート
      downloadPresetsAsFile(availablePresets);
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(
        `エクスポートに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importPresetsFromFile(file);
      if (!result.success || !result.presets) {
        setErrorMessage(result.error || 'インポートに失敗しました');
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      // 旧形式を新形式（グループ構造）に変換
      const convertedPresets = result.presets.map((preset) => ({
        ...preset,
        actions: preset.actions.map((action) => {
          // 既にグループ構造がある場合はそのまま
          if (action.groups && action.groups.length > 0) {
            return action;
          }

          // 旧形式（results/types）を新形式（groups）に変換
          const groups = [];
          if (action.results && action.results.length > 0) {
            groups.push({
              groupName: 'Result',
              options: action.results,
            });
          }
          if (action.types && action.types.length > 0) {
            groups.push({
              groupName: 'Type',
              options: action.types,
            });
          }

          return {
            ...action,
            groups: groups.length > 0 ? groups : undefined,
            // 後方互換性のため保持
            results: action.results || [],
            types: action.types || [],
          };
        }),
      }));

      // ID衝突を解決
      const resolvedPresets = resolvePresetIdConflicts(
        presets,
        convertedPresets,
      );
      setPresets([...presets, ...resolvedPresets]);
      setErrorMessage(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(
        `インポートに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      setTimeout(() => setErrorMessage(null), 5000);
    }

    // inputをリセット（同じファイルを再度選択できるようにする）
    event.target.value = '';
  };

  const handleSave = async () => {
    const newSettings: AppSettings = {
      ...settings,
      activePresetId: activeId,
      actionPresets: presets,
    };

    const success = await onSave(newSettings);
    if (success) {
      // Context にも反映
      setContextActivePresetId(activeId);
      await reloadPresets();
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setErrorMessage('設定の保存に失敗しました');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h6" gutterBottom>
        アクションプリセット
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        アクションパネルに表示するプリセットを選択できます
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {/* アクティブなプリセットを選択 */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">使用するプリセット</FormLabel>
        <RadioGroup
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {availablePresets.map((preset) => (
            <FormControlLabel
              key={preset.id}
              value={preset.id}
              control={<Radio />}
              label={`${preset.name} (${preset.actions.length}件のアクション)`}
            />
          ))}
        </RadioGroup>
      </FormControl>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        プリセット管理
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          プリセットを追加
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={availablePresets.length === 0}
        >
          エクスポート
        </Button>
        <Button variant="outlined" startIcon={<UploadIcon />} component="label">
          インポート
          {/* eslint-disable-next-line react/jsx-no-leaked-render */}
          <input type="file" accept=".json" hidden onChange={handleImport} />
        </Button>
      </Stack>

      <List>
        {availablePresets.map((preset) => (
          <ListItem
            key={preset.id}
            secondaryAction={
              <Box>
                <IconButton
                  edge="end"
                  aria-label="編集"
                  onClick={() => handleOpenDialog(preset)}
                  sx={{ mr: 1 }}
                >
                  <EditIcon />
                </IconButton>
                {/* デフォルトプリセットは削除不可 */}
                {!preset.isDefault && (
                  <IconButton
                    edge="end"
                    aria-label="削除"
                    onClick={() => handleDeletePreset(preset.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {preset.name}
                  {preset.isDefault && (
                    <Chip label="デフォルト" size="small" color="default" />
                  )}
                </Box>
              }
              secondary={`${
                preset.actions.length
              }件のアクション: ${preset.actions
                .map((a) => a.action)
                .join(', ')}`}
            />
          </ListItem>
        ))}
      </List>

      {availablePresets.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 3, textAlign: 'center' }}
        >
          プリセットが登録されていません
        </Typography>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2, mt: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2, mt: 3 }}>
          設定を保存しました
        </Alert>
      )}

      <Button variant="contained" onClick={handleSave} fullWidth sx={{ mt: 3 }}>
        保存
      </Button>

      {/* プリセット編集ダイアログ */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingPreset ? 'プリセットを編集' : 'プリセットを追加'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="プリセット名"
            fullWidth
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              アクション一覧
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenActionDialog()}
              sx={{ mb: 1 }}
            >
              アクションを追加
            </Button>

            {formActions.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                アクションが登録されていません
              </Typography>
            )}

            {formActions.map((act, index) => (
              <Paper
                key={`action-${act.action}-${index}`}
                sx={{
                  p: 2,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" fontWeight="bold">
                      {act.action}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      結果: {act.results.length}件 | タイプ: {act.types.length}
                      件
                    </Typography>

                    {/* ホットキー設定部分（HotkeySettingsと同様のUI） */}
                    {editingHotkeyForAction === index ? (
                      <Box sx={{ mt: 1 }}>
                        <Paper
                          sx={{
                            p: 2,
                            mb: 1,
                            bgcolor: 'action.hover',
                            border: '2px dashed',
                            borderColor: hotkeyConflictWarning
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
                            color={hotkeyConflictWarning ? 'error' : 'primary'}
                            sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                          />
                        </Paper>
                        {hotkeyConflictWarning && (
                          <Alert severity="error" sx={{ mb: 1 }}>
                            {hotkeyConflictWarning}
                          </Alert>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleSaveHotkeyEdit}
                            disabled={!capturedKey || !!hotkeyConflictWarning}
                            fullWidth
                          >
                            保存
                          </Button>
                          <Button
                            size="small"
                            onClick={handleCancelHotkeyEdit}
                            fullWidth
                          >
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
                        {act.hotkey ? (
                          <>
                            <Chip
                              label={act.hotkey}
                              size="small"
                              color="primary"
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Team1
                            </Typography>
                            <Chip
                              label={`Shift+${act.hotkey}`}
                              size="small"
                              color="secondary"
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Team2
                            </Typography>
                            <Button
                              size="small"
                              onClick={() => handleStartHotkeyEdit(index)}
                            >
                              変更
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleClearHotkey(index)}
                            >
                              クリア
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            onClick={() => handleStartHotkeyEdit(index)}
                          >
                            ホットキーを設定
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenActionDialog(index)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteAction(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button
            onClick={handleSavePreset}
            variant="contained"
            disabled={!formName || formActions.length === 0}
          >
            {editingPreset ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* アクション編集ダイアログ */}
      <Dialog
        open={actionDialogOpen}
        onClose={handleCloseActionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingActionIndex === null
            ? 'アクションを追加'
            : 'アクションを編集'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="アクション名"
            fullWidth
            value={actionFormName}
            onChange={(e) => setActionFormName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            ラベル設定
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ラベルグループとラベルの階層構造を定義できます
          </Typography>

          {actionFormGroups.map((group, idx) => (
            <Paper
              key={`group-${idx}-${group.groupName}`}
              sx={{ p: 2, mb: 1, bgcolor: 'action.hover' }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField
                  size="small"
                  label="ラベルグループ"
                  value={group.groupName}
                  onChange={(e) => {
                    const updated = [...actionFormGroups];
                    updated[idx].groupName = e.target.value;
                    setActionFormGroups(updated);
                  }}
                  placeholder="例: Result, Type, Position"
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="ラベル（カンマ区切り）"
                  value={group.options}
                  onChange={(e) => {
                    const updated = [...actionFormGroups];
                    updated[idx].options = e.target.value;
                    setActionFormGroups(updated);
                  }}
                  placeholder="例: Try, Drop Goal, Kick Out"
                  sx={{ flex: 2 }}
                  multiline
                />
                <IconButton
                  size="small"
                  onClick={() => {
                    setActionFormGroups(
                      actionFormGroups.filter((_, i) => i !== idx),
                    );
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Paper>
          ))}

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setActionFormGroups([
                ...actionFormGroups,
                { groupName: '', options: '' },
              ]);
            }}
            sx={{ mb: 2 }}
          >
            ラベルグループを追加
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            ※
            ホットキーは保存後、各アクションの「ホットキーを設定」ボタンから設定できます
            <br />※ 修飾キーなし = 最初のチーム、Shift = 2番目のチーム
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>キャンセル</Button>
          <Button
            onClick={handleSaveAction}
            variant="contained"
            disabled={!actionFormName}
          >
            {editingActionIndex === null ? '追加' : '更新'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

ActionPresetSettings.displayName = 'ActionPresetSettings';
