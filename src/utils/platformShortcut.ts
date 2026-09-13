/** Stored accelerators stay portable when settings move between computers. */
export const normalizePortableShortcut = (shortcut: string): string =>
  shortcut
    .split('+')
    .map((part) => {
      const key = part.trim();
      if (/^(command|cmd|commandorcontrol|cmdorctrl)$/i.test(key))
        return 'CommandOrControl';
      if (/^(option|alt)$/i.test(key)) return 'Alt';
      if (/^(control|ctrl)$/i.test(key)) return 'Control';
      return key;
    })
    .join('+');

export const usesAppleKeyboard = (platform: string): boolean =>
  /Mac|iPhone|iPad|iPod/i.test(platform);

export const getKeyboardPlatform = (): string =>
  typeof navigator === 'undefined' ? '' : navigator.platform;

export const capturePortableShortcut = (
  event: Pick<
    KeyboardEvent,
    'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
  >,
  platform: string,
): string => {
  const keys: string[] = [];
  if (event.metaKey)
    keys.push(usesAppleKeyboard(platform) ? 'CommandOrControl' : 'Meta');
  if (event.ctrlKey)
    keys.push(usesAppleKeyboard(platform) ? 'Control' : 'CommandOrControl');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');
  if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  }
  return keys.join('+');
};

export const formatShortcutLabel = (
  shortcut: string,
  platform: string,
): string =>
  normalizePortableShortcut(shortcut)
    .replace(
      /CommandOrControl/g,
      platform === 'portable'
        ? '⌘/Ctrl'
        : usesAppleKeyboard(platform)
          ? '⌘'
          : 'Ctrl',
    )
    .replace(/Control/g, 'Ctrl')
    .replace(/Alt/g, usesAppleKeyboard(platform) ? '⌥' : 'Alt')
    .replace(/Shift/g, usesAppleKeyboard(platform) ? '⇧' : 'Shift');
