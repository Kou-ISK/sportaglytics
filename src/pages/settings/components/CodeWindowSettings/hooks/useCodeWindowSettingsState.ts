import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import { ActionList } from '../../../../../ActionList';
import { TEAM_PLACEHOLDERS } from '../../../../../utils/teamPlaceholder';
import {
  createButton,
  createLayout,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
} from '../utils';

interface UseCodeWindowSettingsStateParams {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<boolean>;
}

const buildSettingsWithCodeWindows = (
  settings: AppSettings,
  codeWindows: CodeWindowLayout[],
  activeCodeWindowId: string | null,
): AppSettings => {
  return {
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
};

export const useCodeWindowSettingsState = ({
  settings,
  onSave,
}: UseCodeWindowSettingsStateParams) => {
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

  const handleExternalOpen = useCallback(
    async (filePath: string, options?: { clearPending?: boolean }) => {
      const api = globalThis.window.electronAPI;
      if (!api?.codeWindow?.loadFile) return;

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

  const importLayoutData = useCallback((data: { version: number; layout: CodeWindowLayout }) => {
    if (data.layout && data.version === 1) {
      const importedLayout = {
        ...data.layout,
        id: createLayout('').id,
        name: `${data.layout.name} (インポート)`,
      };
      setCodeWindows((prev) => [...prev, importedLayout]);
      setActiveCodeWindowId(importedLayout.id);
      setHasChanges(true);
    }
  }, []);

  const handleExportLayout = useCallback(async () => {
    if (!currentLayout) return;
    const api = globalThis.window.electronAPI;
    if (!api?.codeWindow?.saveFile) {
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

    const data = {
      version: 1,
      layout: currentLayout,
      exportedAt: new Date().toISOString(),
    };
    await api.codeWindow.saveFile(data);
  }, [currentLayout]);

  const handleImportLayout = useCallback(async () => {
    const api = globalThis.window.electronAPI;

    if (!api?.codeWindow?.loadFile) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.stcw,.codewindow,.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text) as {
            version: number;
            layout: CodeWindowLayout;
          };
          importLayoutData(data);
        } catch {
          console.error('Failed to import layout');
        }
      };
      input.click();
      return;
    }

    const result = await api.codeWindow.loadFile();
    if (!result) return;
    try {
      const data = result.codeWindow as {
        version: number;
        layout: CodeWindowLayout;
      };
      importLayoutData(data);
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
  }, [importLayoutData]);

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

export type CodeWindowSettingsState = ReturnType<
  typeof useCodeWindowSettingsState
>;
