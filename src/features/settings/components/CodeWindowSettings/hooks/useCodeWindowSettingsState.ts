import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  buildAvailableActions,
  buildAvailableLabelGroups,
  buildSettingsWithCodeWindows,
} from './codeWindowSettingsDerived';
import {
  createButton,
  createLayout,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
} from '../utils';
import { useCodeWindowExternalOpen } from './useCodeWindowExternalOpen';
import { useCodeWindowLayoutIo } from './useCodeWindowLayoutIo';

interface UseCodeWindowSettingsStateParams {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

export const useCodeWindowSettingsState = ({
  settings,
  onSave,
}: UseCodeWindowSettingsStateParams) => {
  const availableActions = useMemo(() => buildAvailableActions(), []);
  const availableLabelGroups = useMemo(() => buildAvailableLabelGroups(), []);

  const [codeWindows, setCodeWindows] = useState<CodeWindowLayout[]>(
    settings.codingPanel?.codeWindows || [],
  );
  const [activeCodeWindowId, setActiveCodeWindowId] = useState<string | null>(
    settings.codingPanel?.activeCodeWindowId || null,
  );
  const codeWindowsRef = useRef(codeWindows);

  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newCanvasWidth, setNewCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [newCanvasHeight, setNewCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const currentLayout = useMemo(() => {
    return codeWindows.find((l) => l.id === activeCodeWindowId) || null;
  }, [codeWindows, activeCodeWindowId]);

  useEffect(() => {
    codeWindowsRef.current = codeWindows;
  }, [codeWindows]);

  const selectedButton = useMemo(() => {
    if (!currentLayout || selectedButtonIds.length === 0) return null;
    return (
      currentLayout.buttons.find((b) => b.id === selectedButtonIds[0]) || null
    );
  }, [currentLayout, selectedButtonIds]);

  const saveSettings = useCallback(async () => {
    const newSettings = buildSettingsWithCodeWindows(
      settings,
      codeWindows,
      activeCodeWindowId,
    );
    const success = await onSave(newSettings);
    if (success) {
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    return success;
  }, [activeCodeWindowId, codeWindows, onSave, settings]);

  useCodeWindowExternalOpen({
    codeWindowsRef,
    setCodeWindows,
    setActiveCodeWindowId,
    setHasChanges,
    setTabIndex,
  });

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

  const handleDuplicateLayout = useCallback((layout: CodeWindowLayout) => {
    const duplicated = createLayout(
      `${layout.name} (コピー)`,
      layout.canvasWidth,
      layout.canvasHeight,
    );
    duplicated.buttons = layout.buttons.map((b) => ({
      ...b,
      id: createButton('action', b.name, 0, 0).id,
    }));
    duplicated.buttonLinks = layout.buttonLinks?.map((l) => ({ ...l })) || [];
    setCodeWindows((prev) => [...prev, duplicated]);
    setActiveCodeWindowId(duplicated.id);
    setHasChanges(true);
  }, []);

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

  const handleButtonsChange = useCallback(
    (buttons: CodeWindowButton[]) => {
      handleLayoutUpdate({ buttons });
    },
    [handleLayoutUpdate],
  );

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

  const { handleExportLayout, handleImportLayout } = useCodeWindowLayoutIo({
    currentLayout,
    setCodeWindows,
    setActiveCodeWindowId,
    setHasChanges,
  });

  return {
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
    setHasChanges,
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
  };
};
