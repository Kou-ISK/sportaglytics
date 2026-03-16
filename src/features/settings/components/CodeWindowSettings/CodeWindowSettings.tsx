import React, { forwardRef, useImperativeHandle } from 'react';
import type {
  AppSettings,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/Settings';
import { useCodeWindowSettingsState } from './hooks/useCodeWindowSettingsState';
import { buildSelectionButtonUpdates } from './codeWindowButtonUpdateUtils';
import type { SettingsTabHandle } from '../../types';
import { CodeWindowSettingsView } from './CodeWindowSettingsView';

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

  const handleCanvasLayoutChange = (layout: CodeWindowLayout) => {
    handleButtonsChange(layout.buttons);
    if (layout.buttonLinks) {
      handleLayoutUpdate({ buttonLinks: layout.buttonLinks });
    }
  };

  const handleSelectedButtonUpdate = (updatedButton: CodeWindowButton) => {
    if (selectedButtonIds.length > 1 && selectedButton) {
      const updates = buildSelectionButtonUpdates(selectedButton, updatedButton);
      if (Object.keys(updates).length > 0) {
        applyUpdatesToSelection(updates);
      }
      return;
    }

    if (selectedButtonIds[0]) {
      handleButtonUpdate(selectedButtonIds[0], updatedButton);
    }
  };

  const handleDeleteSelectedButtons = () => {
    if (selectedButtonIds.length === 0 || !currentLayout) return;
    const nextButtons = currentLayout.buttons.filter(
      (button) => !selectedButtonIds.includes(button.id),
    );
    handleButtonsChange(nextButtons);
    setSelectedButtonIds([]);
  };

  return (
    <CodeWindowSettingsView
      availableActions={availableActions}
      availableLabelGroups={availableLabelGroups}
      codeWindows={codeWindows}
      activeCodeWindowId={activeCodeWindowId}
      currentLayout={currentLayout}
      selectedButton={selectedButton}
      selectedButtonIds={selectedButtonIds}
      tabIndex={tabIndex}
      createDialogOpen={createDialogOpen}
      newLayoutName={newLayoutName}
      newCanvasWidth={newCanvasWidth}
      newCanvasHeight={newCanvasHeight}
      saveSuccess={saveSuccess}
      hasChanges={hasChanges}
      onSave={() => {
        void saveSettings();
      }}
      onSelectCodeWindow={setActiveCodeWindowId}
      onOpenCreateDialog={() => setCreateDialogOpen(true)}
      onCloseCreateDialog={() => setCreateDialogOpen(false)}
      onDuplicateLayout={handleDuplicateLayout}
      onDeleteLayout={handleDeleteLayout}
      onExportLayout={handleExportLayout}
      onImportLayout={handleImportLayout}
      onClearSelection={() => setSelectedButtonIds([])}
      onTabChange={setTabIndex}
      onCanvasLayoutChange={handleCanvasLayoutChange}
      onSelectButtons={setSelectedButtonIds}
      onSelectedButtonUpdate={handleSelectedButtonUpdate}
      onDeleteSelectedButtons={handleDeleteSelectedButtons}
      onNameChange={(name) => handleLayoutUpdate({ name })}
      onCanvasWidthChange={(width) => {
        if (!isNaN(width) && width >= 400 && width <= 2000) {
          handleLayoutUpdate({ canvasWidth: width });
        }
      }}
      onCanvasHeightChange={(height) => {
        if (!isNaN(height) && height >= 300 && height <= 1500) {
          handleLayoutUpdate({ canvasHeight: height });
        }
      }}
      onLayoutNameChange={setNewLayoutName}
      onCreateDialogWidthChange={(width) =>
        setNewCanvasWidth(Math.max(400, Math.min(2000, width)))
      }
      onCreateDialogHeightChange={(height) =>
        setNewCanvasHeight(Math.max(300, Math.min(1500, height)))
      }
      onCreateLayout={handleCreateLayout}
    />
  );
});

CodeWindowSettings.displayName = 'CodeWindowSettings';

export default CodeWindowSettings;
