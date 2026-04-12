import React from 'react';
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
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/settings/coreTypes';
import { TEAM_PLACEHOLDERS } from '../../../../utils/teamPlaceholder';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { ButtonPropertiesEditor } from './ButtonPropertiesEditorNew';
import { CodeWindowCreateDialog } from './CodeWindowCreateDialog';
import { CodeWindowSettingsHeader } from './CodeWindowSettingsHeader';
import { CodeWindowPlaceholderAlert } from './CodeWindowPlaceholderAlert';
import { CodeWindowSelectorBar } from './CodeWindowSelectorBar';

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

interface CodeWindowSettingsViewProps {
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
  codeWindows: CodeWindowLayout[];
  activeCodeWindowId: string | null;
  currentLayout: CodeWindowLayout | null;
  selectedButton: CodeWindowButton | null;
  selectedButtonIds: string[];
  tabIndex: number;
  createDialogOpen: boolean;
  newLayoutName: string;
  newCanvasWidth: number;
  newCanvasHeight: number;
  saveSuccess: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onSelectCodeWindow: (layoutId: string | null) => void;
  onOpenCreateDialog: () => void;
  onCloseCreateDialog: () => void;
  onDuplicateLayout: (layout: CodeWindowLayout) => void;
  onDeleteLayout: (layoutId: string) => void;
  onExportLayout: () => void;
  onImportLayout: () => void;
  onClearSelection: () => void;
  onTabChange: (nextTab: number) => void;
  onCanvasLayoutChange: (layout: CodeWindowLayout) => void;
  onSelectButtons: (buttonIds: string[]) => void;
  onSelectedButtonUpdate: (button: CodeWindowButton) => void;
  onDeleteSelectedButtons: () => void;
  onNameChange: (name: string) => void;
  onCanvasWidthChange: (width: number) => void;
  onCanvasHeightChange: (height: number) => void;
  onLayoutNameChange: (name: string) => void;
  onCreateDialogWidthChange: (width: number) => void;
  onCreateDialogHeightChange: (height: number) => void;
  onCreateLayout: () => void;
}

export const CodeWindowSettingsView: React.FC<CodeWindowSettingsViewProps> = ({
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
  onSave,
  onSelectCodeWindow,
  onOpenCreateDialog,
  onCloseCreateDialog,
  onDuplicateLayout,
  onDeleteLayout,
  onExportLayout,
  onImportLayout,
  onClearSelection,
  onTabChange,
  onCanvasLayoutChange,
  onSelectButtons,
  onSelectedButtonUpdate,
  onDeleteSelectedButtons,
  onNameChange,
  onCanvasWidthChange,
  onCanvasHeightChange,
  onLayoutNameChange,
  onCreateDialogWidthChange,
  onCreateDialogHeightChange,
  onCreateLayout,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CodeWindowSettingsHeader hasChanges={hasChanges} onSave={onSave} />

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
        onSelect={onSelectCodeWindow}
        onCreate={onOpenCreateDialog}
        onDuplicate={onDuplicateLayout}
        onExport={onExportLayout}
        onDelete={onDeleteLayout}
        onImport={onImportLayout}
        currentLayout={currentLayout}
        onClearSelection={onClearSelection}
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
            onChange={(_, nextTab) => onTabChange(nextTab)}
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
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <FreeCanvasEditor
                    layout={currentLayout}
                    onLayoutChange={onCanvasLayoutChange}
                    selectedButtonIds={selectedButtonIds}
                    onSelectButtons={onSelectButtons}
                    availableActions={availableActions}
                    availableLabelGroups={availableLabelGroups}
                    showLinks={true}
                  />
                </Box>

                <Box sx={{ width: 320 }}>
                  <ButtonPropertiesEditor
                    button={selectedButton}
                    onUpdate={onSelectedButtonUpdate}
                    onDelete={onDeleteSelectedButtons}
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
                onChange={(event) => onNameChange(event.target.value)}
                fullWidth
              />

              <Box sx={{ display: 'flex', gap: 4 }}>
                <TextField
                  label="キャンバス幅 (px)"
                  type="number"
                  value={currentLayout.canvasWidth}
                  onChange={(event) =>
                    onCanvasWidthChange(parseInt(event.target.value, 10))
                  }
                  inputProps={{ min: 400, max: 2000, step: 50 }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="キャンバス高さ (px)"
                  type="number"
                  value={currentLayout.canvasHeight}
                  onChange={(event) =>
                    onCanvasHeightChange(parseInt(event.target.value, 10))
                  }
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
            onClick={onOpenCreateDialog}
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
        onLayoutNameChange={onLayoutNameChange}
        onCanvasWidthChange={onCreateDialogWidthChange}
        onCanvasHeightChange={onCreateDialogHeightChange}
        onClose={onCloseCreateDialog}
        onCreate={onCreateLayout}
      />
    </Box>
  );
};
