// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ExportProgressWindowState } from '../../types/ipc/exportProgressWindow';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  cancel: vi.fn(),
  request: vi.fn(),
}));
vi.mock('../../shared/clipExport/clipExportGateway', () => ({
  subscribeClipExportProgressWindowState: mocks.subscribe,
  requestClipExportProgressWindowState: mocks.request,
  cancelClipExport: mocks.cancel,
  closeExportProgressWindow: vi.fn(),
}));
import { ExportProgressScreen } from './ExportProgressScreen';

it('does not apply a delayed cancellation response to a different displayed job', async () => {
  let notify: ((state: ExportProgressWindowState) => void) | undefined;
  let finish: ((result: 'too-late') => void) | undefined;
  mocks.subscribe.mockImplementation((callback) => {
    notify = callback;
    return () => undefined;
  });
  mocks.request.mockResolvedValue(null);
  mocks.cancel.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<ExportProgressScreen />);
  const state: ExportProgressWindowState = {
    id: 'a',
    status: 'running',
    current: 0,
    total: 1,
    message: 'first',
    startedAt: 1,
    updatedAt: 1,
  };
  act(() => notify?.(state));
  fireEvent.click(screen.getByRole('button', { name: '書き出しを中止' }));
  act(() => notify?.({ ...state, id: 'b', message: 'second', updatedAt: 2 }));
  await act(async () => {
    finish?.('too-late');
    await Promise.resolve();
  });
  expect(screen.getByText('second')).toBeTruthy();
  expect(screen.queryByText(/保存確定中です/)).toBeNull();
  expect(
    screen
      .getByRole('button', { name: '書き出しを中止' })
      .hasAttribute('disabled'),
  ).toBe(false);
});
