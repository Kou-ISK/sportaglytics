import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';
import {
  consumeCodeWindowExternalOpen,
  loadCodeWindowFile,
  subscribeCodeWindowExternalOpen,
} from '../../../gateways/codeWindowFileGateway';
import { createLayout } from '../utils';

interface UseCodeWindowExternalOpenParams {
  codeWindowsRef: React.MutableRefObject<CodeWindowLayout[]>;
  setCodeWindows: React.Dispatch<React.SetStateAction<CodeWindowLayout[]>>;
  setActiveCodeWindowId: React.Dispatch<React.SetStateAction<string | null>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setTabIndex: React.Dispatch<React.SetStateAction<number>>;
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
    typeof value.layout.id === 'string' &&
    typeof value.layout.name === 'string'
  );
};

export const useCodeWindowExternalOpen = ({
  codeWindowsRef,
  setCodeWindows,
  setActiveCodeWindowId,
  setHasChanges,
  setTabIndex,
}: UseCodeWindowExternalOpenParams): void => {
  const handleExternalOpen = useCallback(
    async (filePath: string, options?: { clearPending?: boolean }) => {
      try {
        const result = await loadCodeWindowFile(filePath);
        if (!result) return;

        const data = result.codeWindow;
        if (!isLayoutImportData(data)) return;

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
        if (options?.clearPending) {
          await consumeCodeWindowExternalOpen(filePath);
        }
      }
    },
    [
      codeWindowsRef,
      setActiveCodeWindowId,
      setCodeWindows,
      setHasChanges,
      setTabIndex,
    ],
  );

  useEffect(() => {
    const cleanup = subscribeCodeWindowExternalOpen((filePath: string) => {
      void handleExternalOpen(filePath, { clearPending: true });
    });

    const consumePending = async () => {
      const pendingPath = await consumeCodeWindowExternalOpen();
      if (pendingPath) {
        await handleExternalOpen(pendingPath);
      }
    };

    void consumePending();
    return cleanup;
  }, [handleExternalOpen]);
};
