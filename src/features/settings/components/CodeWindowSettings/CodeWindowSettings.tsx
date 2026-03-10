import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { AppSettings } from '../../../../types/Settings';
import { TEAM_PLACEHOLDERS } from '../../../../utils/teamPlaceholder';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { ButtonPropertiesEditor } from './ButtonPropertiesEditorNew';
import { CodeWindowCreateDialog } from './CodeWindowCreateDialog';
import { CodeWindowSettingsHeader } from './CodeWindowSettingsHeader';
import { CodeWindowPlaceholderAlert } from './CodeWindowPlaceholderAlert';
import { CodeWindowSelectorBar } from './CodeWindowSelectorBar';
import { useCodeWindowSettingsState } from './hooks/useCodeWindowSettingsState';
import { buildSelectionButtonUpdates } from './codeWindowButtonUpdateUtils';
import type { SettingsTabHandle } from '../../types';

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
  const {
    availableActions,
    availableLabelGroups,
    codeWindows,
    activeCodeWindowId,
    currentLayout,
    selectedButton,
    selectedButtonIds,
    tabIndex,
    createDialogOpen,
    newLayoutName,
    newCanvasWidth,
    newCanvasHeight,
    saveSuccess,
    hasChanges,
    setSelectedButtonIds,
    setTabIndex,
    setCreateDialogOpen,
    setNewLayoutName,
    setNewCanvasWidth,
    setNewCanvasHeight,
    setActiveCodeWindowId,
    handleCreateLayout,
    handleDeleteLayout,
    handleDuplicateLayout,
    handleLayoutUpdate,
    handleButtonsChange,
    handleButtonUpdate,
    applyUpdatesToSelection,
    handleExportLayout,
    handleImportLayout,
    saveSettings,
  } = useCodeWindowSettingsState({ settings, onSave });

  useImperativeHandle(
    ref,
    () => ({
      hasUnsavedChanges: () => hasChanges,
      save: saveSettings,
    }),
    [hasChanges, saveSettings],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CodeWindowSettingsHeader hasChanges={hasChanges} onSave={saveSettings} />

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          設定を保存しました
        </Alert>
      )}

      <CodeWindowPlaceholderAlert
        team1Placeholder={TEAM_PLACEHOLDERS.TEAM1}
        team2Placeholder={TEAM_PLACEHOLDERS.TEAM2}
      />

      <CodeWindowSelectorBar
        codeWindows={codeWindows}
        activeCodeWindowId={activeCodeWindowId}
        onSelect={setActiveCodeWindowId}
        onCreate={() => setCreateDialogOpen(true)}
        onDuplicate={handleDuplicateLayout}
        onExport={handleExportLayout}
        onDelete={handleDeleteLayout}
        onImport={handleImportLayout}
        currentLayout={currentLayout}
        onClearSelection={() => setSelectedButtonIds([])}
      />

      {currentLayout ? (
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
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

                <Box sx={{ width: 320 }}>
                  <ButtonPropertiesEditor
                    button={selectedButton}
                    onUpdate={(updatedButton) => {
                      if (selectedButtonIds.length > 1 && selectedButton) {
                        const updates = buildSelectionButtonUpdates(
                          selectedButton,
                          updatedButton,
                        );
                        if (Object.keys(updates).length > 0) {
                          applyUpdatesToSelection(updates);
                        }
                      } else if (selectedButtonIds[0]) {
                        handleButtonUpdate(selectedButtonIds[0], updatedButton);
                      }
                    }}
                    onDelete={() => {
                      if (selectedButtonIds.length === 0 || !currentLayout) return;
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
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
