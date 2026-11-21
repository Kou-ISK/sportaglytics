// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HotkeyConfig } from '../types/settings/coreTypes';
import { useHeldPlayback } from '../shared/hooks/useHeldPlayback';
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

describe('owned reverse key release after editor focus', () => {
  it.each([
    ['slow', 'Left', {}],
    ['2x', 'Shift+Left', { shiftKey: true }],
    ['4x', 'Alt+Left', { altKey: true }],
    ['6x', 'CommandOrControl+Left', { metaKey: true }],
  ] as const)(
    'finishes %s without consuming an editor keyup',
    (suffix, key, modifiers) => {
      const platform = vi
        .spyOn(navigator, 'platform', 'get')
        .mockReturnValue('MacIntel');
      const id = 'reverse-playback-' + suffix;
      const start = vi.fn();
      const finish = vi.fn();
      const binding = [{ id, key, label: id }];
      const hook = renderHook(() =>
        useGlobalHotkeys(binding, { [id]: start }, { [id]: finish }),
      );
      const editor = document.body.appendChild(
        document.createElement('textarea'),
      );
      const edit = vi.fn((event: Event) => event.stopPropagation());
      editor.addEventListener('keyup', edit);
      const send = (
        where: EventTarget,
        type: string,
        k = 'ArrowLeft',
      ): boolean =>
        where.dispatchEvent(
          new KeyboardEvent(type, {
            key: k,
            code: k,
            ...modifiers,
            bubbles: true,
            cancelable: true,
          }),
        );
      try {
        send(editor, 'keydown');
        send(editor, 'keyup');
        expect(start).not.toHaveBeenCalled();
        expect(finish).not.toHaveBeenCalled();
        send(window, 'keydown');
        expect(start).toHaveBeenCalledOnce();
        editor.focus();
        send(editor, 'keyup', 'ArrowRight');
        expect(finish).not.toHaveBeenCalled();
        expect(send(editor, 'keyup')).toBe(true);
        expect(finish).toHaveBeenCalledOnce();
        send(editor, 'keyup');
        expect(edit).toHaveBeenCalledTimes(4);
        expect(finish).toHaveBeenCalledOnce();
      } finally {
        hook.unmount();
        editor.remove();
        platform.mockRestore();
      }
    },
  );
});

it.each([false, true])(
  'restores the prior playing=%s state and rate after a forward hold ends in a note',
  (playing) => {
    const id = 'skip-forward-medium';
    const binding = [{ id, label: id, key: 'Shift+Right' }];
    const before = { playing, rate: 1.25 };
    let state = before;
    const hook = renderHook(() => {
      const forward = useHeldPlayback(
        () => state,
        (next) => {
          state = next;
        },
      );
      useGlobalHotkeys(
        binding,
        { [id]: () => forward.start(id, 2) },
        { [id]: () => forward.stop(id) },
      );
    });
    const editor = document.body.appendChild(
      document.createElement('textarea'),
    );
    editor.addEventListener('keyup', (event) => event.stopPropagation());
    try {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          code: 'ArrowRight',
          shiftKey: true,
        }),
      );
      expect(state).toEqual({ playing: true, rate: 2 });
      editor.focus();
      const release = new KeyboardEvent('keyup', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(release);
      expect(state).toEqual(before);
      expect(release.defaultPrevented).toBe(false);
    } finally {
      hook.unmount();
      editor.remove();
    }
  },
);
