/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import type { HotkeyConfig } from '../types/settings/coreTypes';
import {
  findFallbackKeyUpHotkey,
  findMatchingHotkey,
  parseElectronKey,
  shouldIgnoreHotkeyTarget,
  shouldResetPlaybackHotkeyState,
  sortHotkeysBySpecificity,
} from './globalHotkeyUtils';

const hotkeys: HotkeyConfig[] = [
  { id: 'plain-right', label: 'Plain Right', key: 'Right' },
  { id: 'shift-right', label: 'Shift Right', key: 'Shift+Right' },
  { id: 'cmd-shift-a', label: 'Command Shift A', key: 'Command+Shift+A' },
];

describe('parseElectronKey', () => {
  it('parses modifiers and arrow aliases', () => {
    expect(parseElectronKey('Command+Shift+Right')).toEqual({
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: true,
      key: 'arrowright',
    });
  });
});

describe('sortHotkeysBySpecificity', () => {
  it('sorts hotkeys with more modifiers first', () => {
    expect(
      sortHotkeysBySpecificity(hotkeys).map((hotkey) => hotkey.id),
    ).toEqual(['cmd-shift-a', 'shift-right', 'plain-right']);
  });
});

describe('findMatchingHotkey', () => {
  it('matches the most specific hotkey event', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
    });

    const matched = findMatchingHotkey(
      event,
      sortHotkeysBySpecificity(hotkeys),
    );
    expect(matched?.id).toBe('shift-right');
  });

  it('matches shifted number shortcuts by code', () => {
    const event = new KeyboardEvent('keydown', {
      key: '!',
      code: 'Digit1',
      shiftKey: true,
    });

    const matched = findMatchingHotkey(event, [
      { id: 'digit-hotkey', label: 'Digit', key: 'Shift+1' },
    ]);
    expect(matched?.id).toBe('digit-hotkey');
  });
});

describe('findFallbackKeyUpHotkey', () => {
  it('matches by plain key when modifier state has already changed', () => {
    const event = new KeyboardEvent('keyup', { key: 'ArrowRight' });
    const matched = findFallbackKeyUpHotkey(
      event,
      sortHotkeysBySpecificity(hotkeys),
    );
    expect(matched?.id).toBe('shift-right');
  });
});

describe('shouldIgnoreHotkeyTarget', () => {
  it('ignores inputs and editable content', () => {
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(shouldIgnoreHotkeyTarget(input)).toBe(true);
    expect(shouldIgnoreHotkeyTarget(editable)).toBe(true);
    expect(shouldIgnoreHotkeyTarget(document.createElement('button'))).toBe(
      false,
    );
  });
});

describe('shouldResetPlaybackHotkeyState', () => {
  it('resets on arrow-right and meta release', () => {
    expect(
      shouldResetPlaybackHotkeyState(
        new KeyboardEvent('keyup', { key: 'ArrowRight' }),
      ),
    ).toBe(true);
    expect(
      shouldResetPlaybackHotkeyState(
        new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }),
      ),
    ).toBe(true);
    expect(
      shouldResetPlaybackHotkeyState(new KeyboardEvent('keyup', { key: 'a' })),
    ).toBe(false);
  });
});
