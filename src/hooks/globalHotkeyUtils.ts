import type { HotkeyConfig } from '../types/Settings';

export interface KeyboardModifiers {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
}

type HotkeyKeyboardEvent = Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'
>;

const getNormalizedPart = (part: string): string => {
  return part.trim().toLowerCase();
};

const normalizeEventKey = (key: string): string => {
  return key === ' ' ? ' ' : key.toLowerCase();
};

export const parseElectronKey = (electronKey: string): KeyboardModifiers => {
  const modifiers: KeyboardModifiers = {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    key: '',
  };

  for (const part of electronKey.split('+')) {
    const trimmed = part.trim();
    const normalized = getNormalizedPart(part);

    if (
      normalized === 'command' ||
      normalized === 'cmd' ||
      normalized === 'meta'
    ) {
      modifiers.metaKey = true;
      continue;
    }

    if (normalized === 'control' || normalized === 'ctrl') {
      modifiers.ctrlKey = true;
      continue;
    }

    if (normalized === 'shift') {
      modifiers.shiftKey = true;
      continue;
    }

    if (normalized === 'alt' || normalized === 'option') {
      modifiers.altKey = true;
      continue;
    }

    if (normalized === 'right') {
      modifiers.key = 'arrowright';
      continue;
    }

    if (normalized === 'left') {
      modifiers.key = 'arrowleft';
      continue;
    }

    if (normalized === 'up') {
      modifiers.key = 'arrowup';
      continue;
    }

    if (normalized === 'down') {
      modifiers.key = 'arrowdown';
      continue;
    }

    modifiers.key = normalized === 'space' ? ' ' : trimmed.toLowerCase();
  }

  return modifiers;
};

export const matchesHotkeyEvent = (
  event: HotkeyKeyboardEvent,
  modifiers: KeyboardModifiers,
): boolean => {
  const modifiersMatch =
    event.ctrlKey === modifiers.ctrlKey &&
    event.shiftKey === modifiers.shiftKey &&
    event.altKey === modifiers.altKey &&
    event.metaKey === modifiers.metaKey;

  let keyMatch = normalizeEventKey(event.key) === modifiers.key;

  if (!keyMatch && modifiers.shiftKey && /^\d$/.test(modifiers.key)) {
    keyMatch = event.code === `Digit${modifiers.key}`;
  }

  return modifiersMatch && keyMatch;
};

export const countHotkeyModifiers = (key: string): number => {
  return key.split('+').length - 1;
};

export const sortHotkeysBySpecificity = (
  hotkeys: HotkeyConfig[],
): HotkeyConfig[] => {
  return [...hotkeys]
    .filter((hotkey) => !hotkey.disabled)
    .sort(
      (left, right) =>
        countHotkeyModifiers(right.key) - countHotkeyModifiers(left.key),
    );
};

export const shouldIgnoreHotkeyTarget = (
  target: EventTarget | null,
): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
  );
};

export const findMatchingHotkey = (
  event: HotkeyKeyboardEvent,
  hotkeys: HotkeyConfig[],
): HotkeyConfig | undefined => {
  return hotkeys.find((hotkey) =>
    matchesHotkeyEvent(event, parseElectronKey(hotkey.key)),
  );
};

export const findFallbackKeyUpHotkey = (
  event: Pick<KeyboardEvent, 'key'>,
  hotkeys: HotkeyConfig[],
): HotkeyConfig | undefined => {
  const plainKey = normalizeEventKey(event.key);

  return hotkeys.find((hotkey) => {
    return parseElectronKey(hotkey.key).key === plainKey;
  });
};

export const shouldResetPlaybackHotkeyState = (
  event: Pick<KeyboardEvent, 'code' | 'key'>,
): boolean => {
  const plainKey = normalizeEventKey(event.key);

  return (
    plainKey === 'arrowright' ||
    plainKey === 'right' ||
    plainKey === 'meta' ||
    event.code === 'MetaLeft' ||
    event.code === 'MetaRight'
  );
};
