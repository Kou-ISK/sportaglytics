import type { HotkeyConfig } from '../../../types/Settings';
import { FORBIDDEN_HOTKEYS } from './hotkeySettings.constants';

export const formatKeyCombo = (event: KeyboardEvent): string => {
  const keys: string[] = [];
  if (event.metaKey) keys.push('Command');
  if (event.ctrlKey) keys.push('Control');
  if (event.altKey) keys.push('Option');
  if (event.shiftKey) keys.push('Shift');

  if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    const keyName =
      event.key.length === 1 ? event.key.toUpperCase() : event.key;
    keys.push(keyName);
  }

  return keys.join('+');
};

export const getHotkeyConflictWarning = (params: {
  keyCombo: string;
  editingId: string;
  hotkeys: HotkeyConfig[];
}): string | null => {
  if (FORBIDDEN_HOTKEYS.has(params.keyCombo)) {
    return `"${params.keyCombo}" はシステムで使用されているため設定できません`;
  }

  const duplicate = params.hotkeys.find(
    (hotkey) =>
      hotkey.key === params.keyCombo && hotkey.id !== params.editingId,
  );
  if (duplicate) {
    return `"${params.keyCombo}" は既に「${duplicate.label}」に割り当てられています`;
  }

  return null;
};
