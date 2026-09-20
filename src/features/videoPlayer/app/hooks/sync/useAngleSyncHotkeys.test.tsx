// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAngleSyncHotkeys } from './useAngleSyncHotkeys';
it('uses the same angle/frame commands in either window, protects text editing and removes listeners outside sync', () => {
  const send = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ enabled }) => useAngleSyncHotkeys(enabled, send),
    { initialProps: { enabled: true } },
  );
  fireEvent.keyDown(document.body, { key: '2' });
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(send.mock.calls).toEqual([
    [{ action: 'select', index: 1 }],
    [{ action: 'step', direction: 1 }],
  ]);
  const input = document.createElement('input');
  document.body.append(input);
  fireEvent.keyDown(input, { key: '2' });
  expect(send).toHaveBeenCalledTimes(2);
  rerender({ enabled: false });
  fireEvent.keyDown(document.body, { key: 's' });
  expect(send).toHaveBeenCalledTimes(2);
  input.remove();
  unmount();
});
