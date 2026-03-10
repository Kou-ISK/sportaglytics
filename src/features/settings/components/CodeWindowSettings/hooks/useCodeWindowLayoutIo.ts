import { useCallback } from 'react';
import type React from 'react';
import type { CodeWindowLayout } from '../../../../../types/Settings';
import { createLayout } from '../utils';

interface UseCodeWindowLayoutIoParams {
  currentLayout: CodeWindowLayout | null;
  setCodeWindows: React.Dispatch<React.SetStateAction<CodeWindowLayout[]>>;
  setActiveCodeWindowId: React.Dispatch<React.SetStateAction<string | null>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useCodeWindowLayoutIo = ({
  currentLayout,
  setCodeWindows,
  setActiveCodeWindowId,
  setHasChanges,
}: UseCodeWindowLayoutIoParams) => {
  const importLayoutData = useCallback(
    (data: { version: number; layout: CodeWindowLayout }) => {
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
    },
    [setActiveCodeWindowId, setCodeWindows, setHasChanges],
  );

  const handleExportLayout = useCallback(async () => {
    if (!currentLayout) return;
    const api = globalThis.window.electronAPI;
    const data = {
      version: 1,
      layout: currentLayout,
      exportedAt: new Date().toISOString(),
    };

    if (!api?.codeWindow?.saveFile) {
      const safeName = currentLayout.name.replace(/\s+/g, '_');
      const fileName = `${safeName}.stcw`;
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return;
    }

    await api.codeWindow.saveFile(data);
  }, [currentLayout]);

  const handleImportLayout = useCallback(async () => {
    const api = globalThis.window.electronAPI;

    if (!api?.codeWindow?.loadFile) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.stcw,.codewindow,.json';
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
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
    handleExportLayout,
    handleImportLayout,
  };
};
