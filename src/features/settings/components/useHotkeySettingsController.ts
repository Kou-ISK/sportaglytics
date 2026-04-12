import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HotkeyConfig } from '../../../types/Settings';
import { DEFAULT_HOTKEYS } from './hotkeySettings.constants';
import {
  formatKeyCombo,
  getHotkeyConflictWarning,
} from './hotkeySettings.utils';

interface UseHotkeySettingsControllerParams {
  initialHotkeys: HotkeyConfig[];
}

export const useHotkeySettingsController = ({
  initialHotkeys,
}: UseHotkeySettingsControllerParams) => {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(
    initialHotkeys.length > 0 ? initialHotkeys : DEFAULT_HOTKEYS,
  );
  const [savedHotkeys, setSavedHotkeys] = useState<HotkeyConfig[]>(
    initialHotkeys.length > 0 ? initialHotkeys : DEFAULT_HOTKEYS,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capturedKey, setCapturedKey] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setCapturedKey('');
    setConflictWarning(null);
  }, []);

  useEffect(() => {
    if (editingId === null) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        handleEditCancel();
        return;
      }

      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        return;
      }

      const keyCombo = formatKeyCombo(event);
      setCapturedKey(keyCombo);
      setConflictWarning(
        getHotkeyConflictWarning({
          keyCombo,
          editingId,
          hotkeys,
        }),
      );
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingId, handleEditCancel, hotkeys]);

  const handleEditStart = useCallback((hotkey: HotkeyConfig) => {
    setEditingId(hotkey.id);
    setCapturedKey(hotkey.key);
    setConflictWarning(null);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editingId || !capturedKey || conflictWarning) return;

    setHotkeys((prev) =>
      prev.map((hotkey) =>
        hotkey.id === editingId ? { ...hotkey, key: capturedKey } : hotkey,
      ),
    );
    setEditingId(null);
    setCapturedKey('');
    setConflictWarning(null);
  }, [capturedKey, conflictWarning, editingId]);

  const handleResetToDefaults = useCallback(() => {
    setHotkeys(DEFAULT_HOTKEYS);
  }, []);

  const markSaved = useCallback(() => {
    setSavedHotkeys(hotkeys);
  }, [hotkeys]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(hotkeys) !== JSON.stringify(savedHotkeys),
    [hotkeys, savedHotkeys],
  );

  return {
    hotkeys,
    editingId,
    capturedKey,
    conflictWarning,
    saveSuccess,
    setSaveSuccess,
    hasUnsavedChanges,
    handleEditStart,
    handleEditSave,
    handleEditCancel,
    handleResetToDefaults,
    markSaved,
  };
};
