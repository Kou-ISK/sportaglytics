import { useCallback } from 'react';
import type React from 'react';
import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';
import {
  canUseCodeWindowFileApi,
  loadCodeWindowFile,
  saveCodeWindowFile,
} from '../../../gateways/codeWindowFileGateway';
import { createLayout } from '../utils';

interface UseCodeWindowLayoutIoParams {
  currentLayout: CodeWindowLayout | null;
  setCodeWindows: React.Dispatch<React.SetStateAction<CodeWindowLayout[]>>;
  setActiveCodeWindowId: React.Dispatch<React.SetStateAction<string | null>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isLayoutImportData = (
  value: unknown,
): value is { version: number; layout: CodeWindowLayout } => {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isRecord(value.layout) &&
    typeof value.layout.name === 'string'
  );
};

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
    const data = {
      version: 1,
      layout: currentLayout,
      exportedAt: new Date().toISOString(),
    };

    if (!canUseCodeWindowFileApi()) {
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

    await saveCodeWindowFile(data);
  }, [currentLayout]);

  const handleImportLayout = useCallback(async () => {
    if (!canUseCodeWindowFileApi()) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.stcw,.codewindow,.json';
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text) as unknown;
          if (isLayoutImportData(data)) {
            importLayoutData(data);
          }
        } catch {
          console.error('Failed to import layout');
        }
      };
      input.click();
      return;
    }

    const result = await loadCodeWindowFile();
    if (!result) return;
    try {
      if (isLayoutImportData(result.codeWindow)) {
        importLayoutData(result.codeWindow);
      }
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
  }, [importLayoutData]);

  return {
    handleExportLayout,
    handleImportLayout,
  };
};
