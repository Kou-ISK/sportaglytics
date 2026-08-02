// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HotkeyConfig } from '../types/settings/coreTypes';
import { useGlobalHotkeys } from './useGlobalHotkeys';

const playPauseHotkey: HotkeyConfig = {
  id: 'play-pause',
  label: '再生/停止',
  key: 'Space',
};

describe('useGlobalHotkeys', () => {
  it('runs a toggle shortcut only once while the physical key is held', () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalHotkeys([playPauseHotkey], { 'play-pause': handler }),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space' }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        repeat: true,
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
