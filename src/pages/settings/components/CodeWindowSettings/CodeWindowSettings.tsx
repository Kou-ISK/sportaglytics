import React, {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
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
  Alert,
  Divider,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import type {
  AppSettings,
  CodeWindowLayout,
  CodeWindowButton,
} from '../../../../types/Settings';
import { ActionList } from '../../../../ActionList';
import { TEAM_PLACEHOLDERS } from '../../../../utils/teamPlaceholder';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { ButtonPropertiesEditor } from './ButtonPropertiesEditorNew';
import { CodeWindowCreateDialog } from './CodeWindowCreateDialog';
import { CodeWindowSettingsHeader } from './CodeWindowSettingsHeader';
import { CodeWindowPlaceholderAlert } from './CodeWindowPlaceholderAlert';
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
  // アクション/ラベル候補はActionListから取得
  const availableActions = useMemo(() => {
    const base = ActionList.map((a) => a.action);
    return base.flatMap((action) => [
      `${TEAM_PLACEHOLDERS.TEAM1} ${action}`,
      `${TEAM_PLACEHOLDERS.TEAM2} ${action}`,
    ]);
  }, []);

  const availableLabelGroups = useMemo(() => {
    const groupMap = new Map<string, Set<string>>();

    ActionList.forEach((action) => {
      const groups = (
        action as { groups?: { groupName: string; options: string[] }[] }
      ).groups;
      if (Array.isArray(groups)) {
        groups.forEach((g) => {
          const existing = groupMap.get(g.groupName) || new Set<string>();
          g.options.forEach((opt) => existing.add(opt));
          groupMap.set(g.groupName, existing);
        });
      }
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

    return Array.from(groupMap.entries()).map(([groupName, optionsSet]) => ({
      groupName,
      options: Array.from(optionsSet).sort((a, b) => a.localeCompare(b)),
    }));
  }, []);

  // コードウィンドウ管理
  const [codeWindows, setCodeWindows] = useState<CodeWindowLayout[]>(
    settings.codingPanel?.codeWindows || [],
  );
  const [activeCodeWindowId, setActiveCodeWindowId] = useState<string | null>(
    settings.codingPanel?.activeCodeWindowId || null,
  );
  const codeWindowsRef = useRef(codeWindows);

  // UI状態
  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newCanvasWidth, setNewCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [newCanvasHeight, setNewCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 現在選択中のレイアウト
  const currentLayout = useMemo(() => {
    return codeWindows.find((l) => l.id === activeCodeWindowId) || null;
  }, [codeWindows, activeCodeWindowId]);

  useEffect(() => {
    codeWindowsRef.current = codeWindows;
  }, [codeWindows]);

  // 選択中のボタン
  const selectedButton = useMemo(() => {
    if (!currentLayout || selectedButtonIds.length === 0) return null;
    return (
      currentLayout.buttons.find((b) => b.id === selectedButtonIds[0]) || null
    );
  }, [currentLayout, selectedButtonIds]);

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
          codeWindows,
          activeCodeWindowId: activeCodeWindowId || undefined,
          actionLinks: settings.codingPanel?.actionLinks || [],
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

  const handleExternalOpen = useCallback(
    async (filePath: string, options?: { clearPending?: boolean }) => {
      const api = globalThis.window.electronAPI;
      if (!api?.codeWindow?.loadFile) return;

      console.log(`外部からコードウィンドウファイルを開きます: ${filePath}`);

      try {
        const result = await api.codeWindow.loadFile(filePath);
        if (!result) return;

        const data = result.codeWindow as {
          version: number;
          layout: CodeWindowLayout;
        };
        if (!data.layout || data.version !== 1) return;

        const existing = codeWindowsRef.current.find(
          (layout) => layout.id === data.layout.id,
        );
        if (existing) {
          setActiveCodeWindowId(existing.id);
          setTabIndex(1);
          return;
        }

        const importedLayout = {
          ...data.layout,
          id: createLayout('').id,
          name: `${data.layout.name} (インポート)`,
        };
        setCodeWindows((prev) => [...prev, importedLayout]);
        setActiveCodeWindowId(importedLayout.id);
        setHasChanges(true);
        setTabIndex(1);
      } catch (error) {
        console.error('コードウィンドウファイルの読み込みに失敗:', error);
      } finally {
        if (options?.clearPending && api.codeWindow.consumeExternalOpen) {
          await api.codeWindow.consumeExternalOpen(filePath);
        }
      }
    },
    [],
  );

  // 外部からコードウィンドウファイルが開かれたときの処理
  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.codeWindow?.onExternalOpen) return;

    const cleanup = api.codeWindow.onExternalOpen((filePath: string) => {
      void handleExternalOpen(filePath, { clearPending: true });
    });

    const consumePending = async () => {
      if (!api.codeWindow.consumeExternalOpen) return;
      const pendingPath = await api.codeWindow.consumeExternalOpen();
      if (pendingPath) {
        await handleExternalOpen(pendingPath);
      }
    };

    void consumePending();

    return cleanup;
  }, [handleExternalOpen]);

  // コードウィンドウ作成
  const handleCreateLayout = useCallback(() => {
    if (!newLayoutName.trim()) return;
    const newLayout = createLayout(
      newLayoutName,
      newCanvasWidth,
      newCanvasHeight,
    );
    setCodeWindows((prev) => [...prev, newLayout]);
    setActiveCodeWindowId(newLayout.id);
    setHasChanges(true);
    setCreateDialogOpen(false);
    setNewLayoutName('');
  }, [newLayoutName, newCanvasWidth, newCanvasHeight]);

  // コードウィンドウ削除
  const handleDeleteLayout = useCallback(
    (layoutId: string) => {
      setCodeWindows((prev) => prev.filter((l) => l.id !== layoutId));
      if (activeCodeWindowId === layoutId) {
        setActiveCodeWindowId(null);
      }
      setHasChanges(true);
    },
    [activeCodeWindowId],
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
    setCodeWindows((prev) => [...prev, duplicated]);
    setActiveCodeWindowId(duplicated.id);
    setHasChanges(true);
  }, []);

  // コードウィンドウ更新
  const handleLayoutUpdate = useCallback(
    (updates: Partial<CodeWindowLayout>) => {
      if (!activeCodeWindowId) return;
      setCodeWindows((prev) =>
        prev.map((l) =>
          l.id === activeCodeWindowId ? { ...l, ...updates } : l,
        ),
      );
      setHasChanges(true);
    },
    [activeCodeWindowId],
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

  const applyUpdatesToSelection = useCallback(
    (updates: Partial<CodeWindowButton>) => {
      if (!currentLayout || selectedButtonIds.length === 0) return;
      const nextButtons = currentLayout.buttons.map((b) =>
        selectedButtonIds.includes(b.id) ? { ...b, ...updates } : b,
      );
      handleButtonsChange(nextButtons);
    },
    [currentLayout, selectedButtonIds, handleButtonsChange],
  );

  // コードウィンドウエクスポート（.stcw ファイル）
  const handleExportLayout = useCallback(async () => {
    if (!currentLayout) return;

    const api = globalThis.window.electronAPI;
    if (!api?.codeWindow?.saveFile) {
      // フォールバック: ブラウザダウンロード
      const safeName = currentLayout.name.replace(/\s+/g, '_');
      const fileName = `${safeName}.stcw`;
      const data = {
        version: 1,
        layout: currentLayout,
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
      return;
    }

    // Electron API を使用して保存
    const data = {
      version: 1,
      layout: currentLayout,
      exportedAt: new Date().toISOString(),
    };

    const savedPath = await api.codeWindow.saveFile(data);
    if (savedPath) {
      console.log(`コードウィンドウを保存しました: ${savedPath}`);
    }
  }, [currentLayout]);

  // コードウィンドウインポート（.stcw ファイル）
  const handleImportLayout = useCallback(async () => {
    const api = globalThis.window.electronAPI;

    if (!api?.codeWindow?.loadFile) {
      // フォールバック: ブラウザファイル選択
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.stcw,.codewindow,.json';
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
            setCodeWindows((prev) => [...prev, importedLayout]);
            setActiveCodeWindowId(importedLayout.id);
            setHasChanges(true);
          }
        } catch {
          console.error('Failed to import layout');
        }
      };
      input.click();
      return;
    }

    // Electron API を使用して読み込み
    const result = await api.codeWindow.loadFile();
    if (!result) return;

    try {
      const data = result.codeWindow as {
        version: number;
        layout: CodeWindowLayout;
      };
      if (data.layout && data.version === 1) {
        const importedLayout = {
          ...data.layout,
          id: createLayout('').id, // 新しいIDを生成
          name: `${data.layout.name} (インポート)`,
        };
        setCodeWindows((prev) => [...prev, importedLayout]);
        setActiveCodeWindowId(importedLayout.id);
        setHasChanges(true);
        console.log(`コードウィンドウを読み込みました: ${result.filePath}`);
      }
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
  }, []);

  // 保存
  const handleSave = useCallback(async () => {
    const newSettings: AppSettings = {
      ...settings,
      codingPanel: {
        ...settings.codingPanel,
        defaultMode: settings.codingPanel?.defaultMode || 'code',
        toolbars: settings.codingPanel?.toolbars || [],
        codeWindows,
        activeCodeWindowId: activeCodeWindowId || undefined,
        actionLinks: settings.codingPanel?.actionLinks || [],
      },
    };
    const success = await onSave(newSettings);
    if (success) {
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }, [settings, codeWindows, activeCodeWindowId, onSave]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CodeWindowSettingsHeader hasChanges={hasChanges} onSave={handleSave} />

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          設定を保存しました
        </Alert>
      )}

      {/* プレースホルダーの説明 */}
      <CodeWindowPlaceholderAlert
        team1Placeholder={TEAM_PLACEHOLDERS.TEAM1}
        team2Placeholder={TEAM_PLACEHOLDERS.TEAM2}
      />

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
              value={activeCodeWindowId || ''}
              label="コードウィンドウ"
              onChange={(e) => {
                setActiveCodeWindowId(e.target.value || null);
                setSelectedButtonIds([]);
              }}
            >
              <MenuItem value="">
                <em>なし</em>
              </MenuItem>
              {codeWindows.map((cw) => (
                <MenuItem key={cw.id} value={cw.id}>
                  {cw.name}
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
                      selectedButtonIds={selectedButtonIds}
                      onSelectButtons={setSelectedButtonIds}
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
                        if (selectedButtonIds.length > 1 && selectedButton) {
                          type UpdatableKey =
                            | 'color'
                            | 'textColor'
                            | 'borderRadius'
                            | 'textAlign'
                            | 'width'
                            | 'height'
                            | 'x'
                            | 'y'
                            | 'fontSize'
                            | 'hotkey'
                            | 'name'
                            | 'labelValue'
                            | 'team';
                          const updates: Partial<
                            Pick<CodeWindowButton, UpdatableKey>
                          > = {};
                          const keys: UpdatableKey[] = [
                            'color',
                            'textColor',
                            'borderRadius',
                            'textAlign',
                            'width',
                            'height',
                            'x',
                            'y',
                            'fontSize',
                            'hotkey',
                            'name',
                            'labelValue',
                            'team',
                          ];
                          keys.forEach((key) => {
                            const nextValue = updatedButton[key];
                            const prevValue = selectedButton[key];
                            if (
                              nextValue === undefined ||
                              nextValue === prevValue
                            )
                              return;
                            (updates as Record<string, unknown>)[key] =
                              nextValue;
                          });
                          if (Object.keys(updates).length > 0) {
                            applyUpdatesToSelection(updates);
                          }
                        } else if (selectedButtonIds[0]) {
                          handleButtonUpdate(
                            selectedButtonIds[0],
                            updatedButton,
                          );
                        }
                      }}
                      onDelete={() => {
                        if (selectedButtonIds.length === 0 || !currentLayout)
                          return;
                        const newButtons = currentLayout.buttons.filter(
                          (b) => !selectedButtonIds.includes(b.id),
                        );
                        handleButtonsChange(newButtons);
                        setSelectedButtonIds([]);
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
                  選択中のボタンは Cmd/Ctrl+C でコピー、Cmd/Ctrl+V
                  でペーストできます。
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

      <CodeWindowCreateDialog
        open={createDialogOpen}
        layoutName={newLayoutName}
        canvasWidth={newCanvasWidth}
        canvasHeight={newCanvasHeight}
        onLayoutNameChange={setNewLayoutName}
        onCanvasWidthChange={(value) =>
          setNewCanvasWidth(Math.max(400, Math.min(2000, value)))
        }
        onCanvasHeightChange={(value) =>
          setNewCanvasHeight(Math.max(300, Math.min(1500, value)))
        }
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateLayout}
      />
    </Box>
  );
});

CodeWindowSettings.displayName = 'CodeWindowSettings';

export default CodeWindowSettings;
