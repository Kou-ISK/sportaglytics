// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { HotkeyConfig } from '../../../../../types/settings/coreTypes';
import { useAngleSyncHotkeys } from './useAngleSyncHotkeys';
const hotkeys: HotkeyConfig[] = [
  { id: 'toggle-angle1', label: 'Angle 1', key: 'Alt+A' },
  { id: 'toggle-angle2', label: 'Angle 2', key: 'Shift+2' },
  { id: 'toggle-angle3', label: 'Angle 3', key: 'Control+J' },
  { id: 'toggle-angle4', label: 'Angle 4', key: '4', disabled: true },
  { id: 'toggle-angle8', label: 'Angle 8', key: 'S' },
];
it('uses customized playback keys including modifiers, honors disabled keys and suppresses repeats', () => {
  const send = vi.fn();
  const { unmount } = renderHook(() =>
    useAngleSyncHotkeys(true, send, hotkeys),
  );
  fireEvent.keyDown(document.body, { key: '1' });
  fireEvent.keyDown(document.body, { key: '2' });
  fireEvent.keyDown(document.body, { key: '4' });
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'a', altKey: true });
  // Windows produces @ instead of 2; use the same matcher as playback.
  fireEvent.keyDown(document.body, {
    key: '@',
    code: 'Digit2',
    shiftKey: true,
  });
  fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
  fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true, repeat: true });
  fireEvent.keyDown(document.body, { key: 's' });
  expect(send.mock.calls).toEqual(
    [0, 1, 2, 7].map((index) => [{ action: 'select', index }]),
  );
  unmount();
});
it('updates settings live, protects text/menu input and removes listeners outside sync', () => {
  const send = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ enabled, keys }) => useAngleSyncHotkeys(enabled, send, keys),
    { initialProps: { enabled: true, keys: hotkeys } },
  );
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(send).toHaveBeenLastCalledWith({ action: 'step', direction: 1 });
  const input = document.createElement('input');
  document.body.append(input);
  fireEvent.keyDown(input, { key: 'a', altKey: true });
  fireEvent.keyDown(input, { key: 'ArrowRight' });
  expect(send).toHaveBeenCalledTimes(1);
  rerender({ enabled: true, keys: [{ ...hotkeys[0], key: 'Control+Q' }] });
  fireEvent.keyDown(document.body, { key: 'a', altKey: true });
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document.body, { key: 'q', ctrlKey: true });
  expect(send).toHaveBeenLastCalledWith({ action: 'select', index: 0 });
  rerender({ enabled: false, keys: hotkeys });
  fireEvent.keyDown(document.body, { key: 's' });
  expect(send).toHaveBeenCalledTimes(2);
  input.remove();
  unmount();
});
