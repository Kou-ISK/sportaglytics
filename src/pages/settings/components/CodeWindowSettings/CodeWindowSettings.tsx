import React, {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import type {
  AppSettings,
  CodeWindowLayout,
  CodeWindowButton,
  ActionLink,
} from '../../../../types/Settings';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { ButtonPropertiesEditor } from './ButtonPropertiesEditorNew';
import { LinkEditor } from './LinkEditor';
import {
  createLayout,
  createButton,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
} from './utils';
import type { SettingsTabHandle } from '../../../SettingsPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

interface CodeWindowSettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const CodeWindowSettings = forwardRef<
  SettingsTabHandle,
  CodeWindowSettingsProps
>(({ settings, onSave }, ref) => {
  // アクティブなプリセットからアクションとラベルグループを取得
  const activePreset = useMemo(() => {
    return (
      settings.actionPresets.find((p) => p.id === settings.activePresetId) ||
      settings.actionPresets.find((p) => p.isDefault) ||
      settings.actionPresets[0]
    );
  }, [settings.actionPresets, settings.activePresetId]);

  const availableActions = useMemo(() => {
    if (!activePreset) return [];
    return activePreset.actions.map((a) => a.action);
  }, [activePreset]);

  const availableLabelGroups = useMemo(() => {
    if (!activePreset) return [];
    // 全アクションからラベルグループをマージ（重複オプションも統合）
    const groupMap = new Map<string, Set<string>>();

    activePreset.actions.forEach((action) => {
      // 新しいgroups構造から取得
      if (action.groups) {
        action.groups.forEach((g) => {
          const existing = groupMap.get(g.groupName) || new Set<string>();
          g.options.forEach((opt) => existing.add(opt));
          groupMap.set(g.groupName, existing);
        });
      }
      // 後方互換性: results/typesもラベルグループとして扱う
      if (action.results?.length > 0) {
        const existing = groupMap.get('Result') || new Set<string>();
        action.results.forEach((r) => existing.add(r));
        groupMap.set('Result', existing);
      }
      if (action.types?.length > 0) {
        const existing = groupMap.get('Type') || new Set<string>();
        action.types.forEach((t) => existing.add(t));
        groupMap.set('Type', existing);
      }
    });

    // MapからArrayに変換
    return Array.from(groupMap.entries()).map(([groupName, optionsSet]) => ({
      groupName,
      options: Array.from(optionsSet).sort((a, b) => a.localeCompare(b)),
    }));
  }, [activePreset]);

  // コードウィンドウ管理
  const [layouts, setLayouts] = useState<CodeWindowLayout[]>(
    settings.codingPanel?.layouts || [],
  );
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(
    settings.codingPanel?.activeLayoutId || null,
  );
  const [links, setLinks] = useState<ActionLink[]>(
    settings.codingPanel?.actionLinks || [],
  );

  // UI状態
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newCanvasWidth, setNewCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [newCanvasHeight, setNewCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 現在選択中のレイアウト
  const currentLayout = useMemo(() => {
    return layouts.find((l) => l.id === activeLayoutId) || null;
  }, [layouts, activeLayoutId]);

  // 選択中のボタン
  const selectedButton = useMemo(() => {
    if (!currentLayout || !selectedButtonId) return null;
    return currentLayout.buttons.find((b) => b.id === selectedButtonId) || null;
  }, [currentLayout, selectedButtonId]);

  // SettingsTabHandle実装
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => hasChanges,
    save: async () => {
      const newSettings: AppSettings = {
        ...settings,
        codingPanel: {
          ...settings.codingPanel,
          defaultMode: settings.codingPanel?.defaultMode || 'code',
          toolbars: settings.codingPanel?.toolbars || [],
          layouts,
          activeLayoutId: activeLayoutId || undefined,
          actionLinks: links,
        },
      };
      const success = await onSave(newSettings);
      if (success) {
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
      return success;
    },
  }));

  // コードウィンドウ作成
  const handleCreateLayout = useCallback(() => {
    if (!newLayoutName.trim()) return;
    const newLayout = createLayout(
      newLayoutName,
      newCanvasWidth,
      newCanvasHeight,
    );
    setLayouts((prev) => [...prev, newLayout]);
    setActiveLayoutId(newLayout.id);
    setHasChanges(true);
    setCreateDialogOpen(false);
    setNewLayoutName('');
  }, [newLayoutName, newCanvasWidth, newCanvasHeight]);

  // コードウィンドウ削除
  const handleDeleteLayout = useCallback(
    (layoutId: string) => {
      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));
      if (activeLayoutId === layoutId) {
        setActiveLayoutId(null);
      }
      setHasChanges(true);
    },
    [activeLayoutId],
  );

  // コードウィンドウ複製
  const handleDuplicateLayout = useCallback((layout: CodeWindowLayout) => {
    const duplicated = createLayout(
      `${layout.name} (コピー)`,
      layout.canvasWidth,
      layout.canvasHeight,
    );
    duplicated.buttons = layout.buttons.map((b) => ({
      ...b,
      id: createButton('action', b.name, 0, 0).id, // 新しいIDを生成
    }));
    duplicated.buttonLinks = layout.buttonLinks?.map((l) => ({ ...l })) || [];
    setLayouts((prev) => [...prev, duplicated]);
    setActiveLayoutId(duplicated.id);
    setHasChanges(true);
  }, []);

  // コードウィンドウ更新
  const handleLayoutUpdate = useCallback(
    (updates: Partial<CodeWindowLayout>) => {
      if (!activeLayoutId) return;
      setLayouts((prev) =>
        prev.map((l) => (l.id === activeLayoutId ? { ...l, ...updates } : l)),
      );
      setHasChanges(true);
    },
    [activeLayoutId],
  );

  // ボタン更新
  const handleButtonsChange = useCallback(
    (buttons: CodeWindowButton[]) => {
      handleLayoutUpdate({ buttons });
    },
    [handleLayoutUpdate],
  );

  // ボタンプロパティ更新
  const handleButtonUpdate = useCallback(
    (buttonId: string, updates: Partial<CodeWindowButton>) => {
      if (!currentLayout) return;
      const newButtons = currentLayout.buttons.map((b) =>
        b.id === buttonId ? { ...b, ...updates } : b,
      );
      handleButtonsChange(newButtons);
    },
    [currentLayout, handleButtonsChange],
  );

  // リンク更新
  const handleLinksChange = useCallback((newLinks: ActionLink[]) => {
    setLinks(newLinks);
    setHasChanges(true);
  }, []);

  // コードウィンドウエクスポート
  const handleExportLayout = useCallback(() => {
    if (!currentLayout) return;
    const safeName = currentLayout.name.replace(/\s+/g, '_');
    const fileName = `${safeName}.codewindow`;
    const data = {
      version: 1,
      layout: currentLayout,
      links: links,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentLayout, links]);

  // コードウィンドウインポート
  const handleImportLayout = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.codewindow,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.layout && data.version === 1) {
          const importedLayout = {
            ...data.layout,
            id: createLayout('').id, // 新しいIDを生成
            name: `${data.layout.name} (インポート)`,
          };
          setLayouts((prev) => [...prev, importedLayout]);
          setActiveLayoutId(importedLayout.id);
          if (data.links && Array.isArray(data.links)) {
            setLinks((prev) => [...prev, ...data.links]);
          }
          setHasChanges(true);
        }
      } catch {
        console.error('Failed to import layout');
      }
    };
    input.click();
  }, []);

  // 保存
  const handleSave = useCallback(async () => {
    const newSettings: AppSettings = {
      ...settings,
      codingPanel: {
        ...settings.codingPanel,
        defaultMode: settings.codingPanel?.defaultMode || 'code',
        toolbars: settings.codingPanel?.toolbars || [],
        layouts,
        activeLayoutId: activeLayoutId || undefined,
        actionLinks: links,
      },
    };
    const success = await onSave(newSettings);
    if (success) {
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }, [settings, layouts, activeLayoutId, links, onSave]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">コードウィンドウ設定</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges}
        >
          保存
        </Button>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          設定を保存しました
        </Alert>
      )}

      {/* プレースホルダーの説明 */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          チーム名プレースホルダー
        </Typography>
        <Typography variant="body2">
          ボタン名に{' '}
          <code>
            ${'{'}Team1{'}'}
          </code>{' '}
          や{' '}
          <code>
            ${'{'}Team2{'}'}
          </code>{' '}
          を使うと、パッケージ設定のチーム名に自動置換されます。
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          例:{' '}
          <code>
            ${'{'}Team1{'}'} タックル
          </code>{' '}
          → <code>Japan タックル</code>（Team1が&quot;Japan&quot;の場合）
        </Typography>
      </Alert>

      {/* コードウィンドウ選択 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>コードウィンドウ</InputLabel>
            <Select
              value={activeLayoutId || ''}
              label="コードウィンドウ"
              onChange={(e) => {
                setActiveLayoutId(e.target.value || null);
                setSelectedButtonId(null);
              }}
            >
              <MenuItem value="">
                <em>なし</em>
              </MenuItem>
              {layouts.map((layout) => (
                <MenuItem key={layout.id} value={layout.id}>
                  {layout.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setCreateDialogOpen(true)}
          >
            コードウィンドウを新規作成
          </Button>
          {currentLayout && (
            <>
              <Tooltip title="複製">
                <IconButton
                  onClick={() => handleDuplicateLayout(currentLayout)}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="エクスポート">
                <IconButton onClick={handleExportLayout}>
                  <FileDownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="削除">
                <IconButton
                  color="error"
                  onClick={() => handleDeleteLayout(currentLayout.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="コードウィンドウをインポート">
            <IconButton onClick={handleImportLayout}>
              <FileUploadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {currentLayout ? (
        <>
          {/* タブ切替 */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab label="ボタン配置" />
              <Tab label="リンク設定" />
              <Tab label="コードウィンドウ設定" />
            </Tabs>

            <TabPanel value={tabIndex} index={0}>
              <Box
                sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}
              >
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {/* キャンバスエディタ */}
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <FreeCanvasEditor
                      layout={currentLayout}
                      onLayoutChange={(layout) => {
                        handleButtonsChange(layout.buttons);
                        if (layout.buttonLinks) {
                          handleLayoutUpdate({
                            buttonLinks: layout.buttonLinks,
                          });
                        }
                      }}
                      selectedButtonId={selectedButtonId}
                      onSelectButton={setSelectedButtonId}
                      availableActions={availableActions}
                      availableLabelGroups={availableLabelGroups}
                      showLinks={true}
                    />
                  </Box>

                  {/* プロパティエディタ */}
                  <Box sx={{ width: 320 }}>
                    <ButtonPropertiesEditor
                      button={selectedButton}
                      onUpdate={(updatedButton) => {
                        if (selectedButtonId) {
                          handleButtonUpdate(selectedButtonId, updatedButton);
                        }
                      }}
                      onDelete={() => {
                        if (selectedButtonId && currentLayout) {
                          const newButtons = currentLayout.buttons.filter(
                            (b) => b.id !== selectedButtonId,
                          );
                          handleButtonsChange(newButtons);
                          setSelectedButtonId(null);
                        }
                      }}
                      availableActions={availableActions}
                      availableLabelGroups={availableLabelGroups}
                      canvasWidth={currentLayout.canvasWidth}
                      canvasHeight={currentLayout.canvasHeight}
                    />
                  </Box>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tabIndex} index={1}>
              <Box sx={{ p: 2 }}>
                <LinkEditor
                  links={links}
                  onLinksChange={handleLinksChange}
                  availableActions={availableActions}
                  availableLabelGroups={availableLabelGroups}
                />
              </Box>
            </TabPanel>

            <TabPanel value={tabIndex} index={2}>
              <Box
                sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                <TextField
                  label="コードウィンドウ名"
                  value={currentLayout.name}
                  onChange={(e) => handleLayoutUpdate({ name: e.target.value })}
                  fullWidth
                />

                <Box sx={{ display: 'flex', gap: 4 }}>
                  <TextField
                    label="キャンバス幅 (px)"
                    type="number"
                    value={currentLayout.canvasWidth}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 400 && value <= 2000) {
                        handleLayoutUpdate({ canvasWidth: value });
                      }
                    }}
                    inputProps={{ min: 400, max: 2000, step: 50 }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="キャンバス高さ (px)"
                    type="number"
                    value={currentLayout.canvasHeight}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 300 && value <= 1500) {
                        handleLayoutUpdate({ canvasHeight: value });
                      }
                    }}
                    inputProps={{ min: 300, max: 1500, step: 50 }}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <Divider />

                <Typography variant="subtitle2" color="text.secondary">
                  ヒント: キャンバス上で右クリックしてボタンを追加できます。
                  ボタンを選択してドラッグで移動、リンクアイコンからドラッグして
                  別のボタンにドロップするとリンクを作成できます。
                  選択中のボタンは Cmd/Ctrl+C でコピー、Cmd/Ctrl+V でペーストできます。
                </Typography>
              </Box>
            </TabPanel>
          </Paper>
        </>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            コードウィンドウが選択されていません
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            新しいコードウィンドウを作成
          </Button>
        </Paper>
      )}

      {/* 新規作成ダイアログ */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新しいコードウィンドウを作成</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              label="コードウィンドウ名"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              fullWidth
              autoFocus
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="キャンバス幅 (px)"
                type="number"
                value={newCanvasWidth}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value))
                    setNewCanvasWidth(Math.max(400, Math.min(2000, value)));
                }}
                inputProps={{ min: 400, max: 2000, step: 50 }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="キャンバス高さ (px)"
                type="number"
                value={newCanvasHeight}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value))
                    setNewCanvasHeight(Math.max(300, Math.min(1500, value)));
                }}
                inputProps={{ min: 300, max: 1500, step: 50 }}
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleCreateLayout}
            variant="contained"
            disabled={!newLayoutName.trim()}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

CodeWindowSettings.displayName = 'CodeWindowSettings';

export default CodeWindowSettings;
