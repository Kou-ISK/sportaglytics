import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { CodeWindowLayout } from '../../../../../types/Settings';
import { createLayout } from '../utils';

interface UseCodeWindowExternalOpenParams {
  codeWindowsRef: React.MutableRefObject<CodeWindowLayout[]>;
  setCodeWindows: React.Dispatch<React.SetStateAction<CodeWindowLayout[]>>;
  setActiveCodeWindowId: React.Dispatch<React.SetStateAction<string | null>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setTabIndex: React.Dispatch<React.SetStateAction<number>>;
}

export const useCodeWindowExternalOpen = ({
  codeWindowsRef,
  setCodeWindows,
  setActiveCodeWindowId,
  setHasChanges,
  setTabIndex,
}: UseCodeWindowExternalOpenParams): void => {
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
    [codeWindowsRef, setActiveCodeWindowId, setCodeWindows, setHasChanges, setTabIndex],
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
};
