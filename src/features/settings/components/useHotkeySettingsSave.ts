import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, HotkeyConfig } from '../../../types/Settings';

interface UseHotkeySettingsSaveParams {
  settings: AppSettings;
  hotkeys: HotkeyConfig[];
  onSave: (settings: AppSettings) => Promise<boolean>;
  markSaved: () => void;
  setSaveSuccess: Dispatch<SetStateAction<boolean>>;
}

export const useHotkeySettingsSave = ({
  settings,
  hotkeys,
  onSave,
  markSaved,
  setSaveSuccess,
}: UseHotkeySettingsSaveParams): (() => Promise<void>) => {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(async (): Promise<void> => {
    const newSettings: AppSettings = {
      ...settings,
      hotkeys,
    };

    const success = await onSave(newSettings);
    if (!success) {
      return;
    }

    markSaved();
    globalThis.window.electronAPI?.notifyHotkeysUpdated?.();

    if (timeoutRef.current !== null) {
      globalThis.clearTimeout(timeoutRef.current);
    }

    setSaveSuccess(true);
    timeoutRef.current = globalThis.setTimeout(() => {
      setSaveSuccess(false);
      timeoutRef.current = null;
    }, 3000);
  }, [hotkeys, markSaved, onSave, setSaveSuccess, settings]);
};
