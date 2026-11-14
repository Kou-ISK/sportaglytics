// @vitest-environment node
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => unknown>(),
  window: null as unknown,
  isFrom: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: class {
    webContents = { isLoading: () => false, send: () => undefined };
    setMenuBarVisibility() {}
    loadURL() {}
    on() {}
    isDestroyed() {
      return false;
    }
    isVisible() {
      return true;
    }
  },
  ipcMain: {
    handle: (name: string, fn: (...args: never[]) => unknown) =>
      mocks.handlers.set(name, fn),
  },
}));
vi.mock('./rendererUrl', () => ({ getRendererUrl: () => 'http://localhost/' }));
vi.mock('./windowSecurity', () => ({ applyWindowSecurity: () => undefined }));
vi.mock('./ipc/windowSenderGuards', () => ({
  getValidatedEventSenderWindow: () => ({}),
  isEventFromWindow: mocks.isFrom,
}));
import {
  openExportProgressWindow,
  registerExportProgressWindowHandlers,
  setExportCancelHandler,
  updateExportProgressWindow,
} from './exportProgressWindow';

it('allows only the progress window to cancel the currently displayed running job', async () => {
  await openExportProgressWindow(false);
  registerExportProgressWindowHandlers();
  setExportCancelHandler(mocks.cancel);
  updateExportProgressWindow({
    id: 'job-a',
    status: 'running',
    current: 0,
    total: 1,
    message: '',
    startedAt: 1,
    updatedAt: 1,
  });
  const handler = mocks.handlers.get('export-progress:cancel');
  if (!handler) throw new Error('missing handler');
  mocks.isFrom.mockReturnValue(false);
  expect(() => handler({} as never, 'job-a' as never)).toThrow('sender');
  mocks.isFrom.mockReturnValue(true);
  expect(handler({} as never, 'other' as never)).toBe('not-found');
  expect(mocks.cancel).not.toHaveBeenCalled();
  mocks.cancel.mockReturnValue('accepted');
  expect(handler({} as never, 'job-a' as never)).toBe('accepted');
  expect(mocks.cancel).toHaveBeenCalledWith('job-a');
  expect(handler({} as never, 'job-a' as never)).toBe('not-found');
});
