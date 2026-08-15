import type { HotkeyConfig } from '../../../types/settings/coreTypes';
import { DEFAULT_SETTINGS } from '../../../types/settings/defaults';

export const DEFAULT_HOTKEYS: HotkeyConfig[] = DEFAULT_SETTINGS.hotkeys.map(
  (hotkey) => ({ ...hotkey }),
);

export const FORBIDDEN_HOTKEYS = new Set([
  'Command+Q',
  'Command+W',
  'Command+N',
  'Command+T',
  'Command+C',
  'Command+V',
  'Command+X',
  'Command+A',
  'Command+S',
  'Command+O',
  'Command+P',
  'Command+F',
  'Command+H',
  'Command+M',
  'Command+Tab',
  'Command+Space',
  'Control+Space',
]);
