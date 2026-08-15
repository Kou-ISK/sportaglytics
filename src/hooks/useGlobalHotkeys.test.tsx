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

  it('stops hold-to-play shortcuts when the window loses focus', () => {
    const stopReverse = vi.fn();
    renderHook(() =>
      useGlobalHotkeys(
        [
          {
            id: 'reverse-playback-2x',
            label: '2倍速逆再生',
            key: 'Shift+Left',
          },
        ],
        { 'reverse-playback-2x': vi.fn() },
        { 'reverse-playback-2x': stopReverse },
      ),
    );

    window.dispatchEvent(new Event('blur'));

    expect(stopReverse).toHaveBeenCalledTimes(1);
  });

  it('starts and stops a modified reverse shortcut on physical key events', () => {
    const startReverse = vi.fn();
    const stopReverse = vi.fn();
    renderHook(() =>
      useGlobalHotkeys(
        [
          {
            id: 'reverse-playback-2x',
            label: '2倍速逆再生',
            key: 'Shift+Left',
          },
        ],
        { 'reverse-playback-2x': startReverse },
        { 'reverse-playback-2x': stopReverse },
      ),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'ArrowLeft', shiftKey: true }),
    );

    expect(startReverse).toHaveBeenCalledTimes(1);
    expect(stopReverse).toHaveBeenCalledTimes(1);
  });
});
