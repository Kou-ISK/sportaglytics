// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  parseElectronKey,
  matchesHotkeyEvent,
  shouldResetPlaybackHotkeyState,
} from '../hooks/globalHotkeyUtils';
import { normalizeAppSettings } from '../types/settings/normalizers';
import {
  formatShortcutLabel,
  capturePortableShortcut,
  normalizePortableShortcut,
} from './platformShortcut';

describe('portable shortcuts', () => {
  it('maps the same saved shortcut to Ctrl on Windows and Command on Mac', () => {
    for (const [platform, ctrlKey, metaKey] of [
      ['Win32', true, false],
      ['MacIntel', false, true],
    ] as const) {
      expect(
        matchesHotkeyEvent(
          {
            key: 's',
            code: 'KeyS',
            ctrlKey,
            metaKey,
            altKey: false,
            shiftKey: false,
          },
          parseElectronKey('CommandOrControl+S', platform),
        ),
      ).toBe(true);
    }
    expect(formatShortcutLabel('CommandOrControl+Alt+S', 'Win32')).toBe(
      'Ctrl+Alt+S',
    );
    expect(formatShortcutLabel('CommandOrControl+Alt+S', 'MacIntel')).toBe(
      '⌘+⌥+S',
    );
  });

  it('migrates existing Mac settings at the load boundary', () => {
    const settings = normalizeAppSettings({
      hotkeys: [{ id: 'undo', key: 'Command+Z' }],
    });
    expect(settings.hotkeys.find(({ id }) => id === 'undo')?.key).toBe(
      'CommandOrControl+Z',
    );
    expect(normalizePortableShortcut('Cmd+Option+Right')).toBe(
      'CommandOrControl+Alt+Right',
    );
  });

  it('captures the primary shortcut consistently for global and coding controls', () => {
    const event = {
      key: 'k',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    };
    expect(capturePortableShortcut(event, 'Win32')).toBe('CommandOrControl+K');
    expect(capturePortableShortcut(event, 'MacIntel')).toBe('Control+K');
  });

  it('stops held playback when Control is released', () => {
    expect(
      shouldResetPlaybackHotkeyState({ key: 'Control', code: 'ControlLeft' }),
    ).toBe(true);
  });
});
