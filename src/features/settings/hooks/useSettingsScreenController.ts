import { useEffect, useRef } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { useUnsavedTabSwitch } from './useUnsavedTabSwitch';
import type { SettingsTabHandle } from '../types';

interface UseSettingsScreenControllerResult {
  settings: ReturnType<typeof useSettings>['settings'];
  isLoading: boolean;
  error: string | null;
  saveSettings: ReturnType<typeof useSettings>['saveSettings'];
  generalRef: React.MutableRefObject<SettingsTabHandle | null>;
  hotkeyRef: React.MutableRefObject<SettingsTabHandle | null>;
  codeWindowRef: React.MutableRefObject<SettingsTabHandle | null>;
  currentTab: number;
  requestTabChange: (tabIndex: number) => void;
  confirmDialogOpen: boolean;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
  handleClose: () => Promise<void>;
}

export const useSettingsScreenController =
  (): UseSettingsScreenControllerResult => {
    const { settings, isLoading, error, saveSettings } = useSettings();

    const generalRef = useRef<SettingsTabHandle | null>(null);
    const hotkeyRef = useRef<SettingsTabHandle | null>(null);
    const codeWindowRef = useRef<SettingsTabHandle | null>(null);

    const checkUnsavedChanges = (tabIndex: number): boolean => {
      switch (tabIndex) {
        case 0:
          return generalRef.current?.hasUnsavedChanges() || false;
        case 1:
          return hotkeyRef.current?.hasUnsavedChanges() || false;
        case 2:
          return codeWindowRef.current?.hasUnsavedChanges() || false;
        default:
          return false;
      }
    };

    const {
      currentTab,
      requestTabChange,
      confirmDialogOpen,
      confirmSwitch,
      cancelSwitch,
    } = useUnsavedTabSwitch({
      hasUnsavedChanges: checkUnsavedChanges,
    });

    useEffect(() => {
      const api = globalThis.window.electronAPI;
      if (!api?.codeWindow?.onExternalOpen) {
        return;
      }

      const handleExternalOpen = () => {
        requestTabChange(2);
      };

      const cleanup = api.codeWindow.onExternalOpen(handleExternalOpen);

      const checkPending = async (): Promise<void> => {
        if (!api.codeWindow.peekExternalOpen) {
          return;
        }
        const pendingPath = await api.codeWindow.peekExternalOpen();
        if (pendingPath) {
          requestTabChange(2);
        }
      };

      void checkPending();

      return cleanup;
    }, [requestTabChange]);

    const handleClose = async (): Promise<void> => {
      const api = globalThis.window.electronAPI;
      if (api?.isSettingsWindowOpen) {
        const isDetached = await api.isSettingsWindowOpen();
        if (isDetached && api.closeSettingsWindow) {
          await api.closeSettingsWindow();
          return;
        }
      }

      const event = new CustomEvent('back-to-main');
      globalThis.dispatchEvent(event);
    };

    return {
      settings,
      isLoading,
      error,
      saveSettings,
      generalRef,
      hotkeyRef,
      codeWindowRef,
      currentTab,
      requestTabChange,
      confirmDialogOpen,
      confirmSwitch,
      cancelSwitch,
      handleClose,
    };
  };
