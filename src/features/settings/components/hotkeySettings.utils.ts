import {
  getKeyboardPlatform,
  capturePortableShortcut,
  formatShortcutLabel,
} from '../../../utils/platformShortcut';
import { parseElectronKey } from '../../../hooks/globalHotkeyUtils';
import type { HotkeyConfig } from '../../../types/settings/coreTypes';
import { FORBIDDEN_HOTKEYS } from './hotkeySettings.constants';

export const formatKeyCombo = (
  event: KeyboardEvent,
  platform = getKeyboardPlatform(),
): string => capturePortableShortcut(event, platform);

export const getHotkeyConflictWarning = (params: {
  keyCombo: string;
  editingId: string;
  hotkeys: HotkeyConfig[];
}): string | null => {
  const platform = getKeyboardPlatform();
  const signature = (key: string): string =>
    JSON.stringify(parseElectronKey(key, platform));
  const keySignature = signature(params.keyCombo);
  const label = formatShortcutLabel(params.keyCombo, platform);
  if ([...FORBIDDEN_HOTKEYS].some((key) => signature(key) === keySignature)) {
    return `"${label}" はシステムで使用されているため設定できません`;
  }

  const duplicate = params.hotkeys.find(
    (hotkey) =>
      signature(hotkey.key) === keySignature && hotkey.id !== params.editingId,
  );
  if (duplicate) {
    return `"${label}" は既に「${duplicate.label}」に割り当てられています`;
  }

  return null;
};
