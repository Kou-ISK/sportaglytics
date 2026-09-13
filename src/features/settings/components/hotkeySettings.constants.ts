import type { HotkeyConfig } from '../../../types/settings/coreTypes';
import { DEFAULT_SETTINGS } from '../../../types/settings/defaults';

export const DEFAULT_HOTKEYS: HotkeyConfig[] = DEFAULT_SETTINGS.hotkeys.map(
  (hotkey) => ({ ...hotkey }),
);

export const FORBIDDEN_HOTKEYS = new Set([
  'CommandOrControl+Q',
  'CommandOrControl+W',
  'CommandOrControl+N',
  'CommandOrControl+T',
  'CommandOrControl+C',
  'CommandOrControl+V',
  'CommandOrControl+X',
  'CommandOrControl+A',
  'CommandOrControl+S',
  'CommandOrControl+O',
  'CommandOrControl+P',
  'CommandOrControl+F',
  'CommandOrControl+H',
  'CommandOrControl+M',
  'CommandOrControl+Tab',
  'CommandOrControl+Space',
  'Control+Space',
  'Alt+F4',
  'Alt+Tab',
  'Control+Alt+Delete',
]);
