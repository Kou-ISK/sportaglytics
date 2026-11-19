import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { scrubPreviewChannels as channels } from '../../../src/types/ipc/scrubPreview';
const mock = vi.hoisted(() => ({
  handlers: new Map<
    string,
    (event: unknown, data: unknown) => Promise<unknown>
  >(),
  sender: vi.fn(),
  session: vi.fn(),
  resolve: vi.fn(),
  produce: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      key: string,
      fn: (event: unknown, data: unknown) => Promise<unknown>,
    ) => mock.handlers.set(key, fn),
  },
}));
vi.mock('../ipc/windowSenderGuards', () => ({
  getValidatedEventSenderWindow: mock.sender,
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: mock.session,
}));
vi.mock('../nativePlayback/nativeSourceAccess', () => ({
  resolveNativeSource: mock.resolve,
}));
vi.mock('./produce', () => ({ produceScrubPreview: mock.produce }));
import { registerScrubPreviewHandlers } from './handlers';
it('authenticates the package, holds the slot through abort and close, and validates again after a revision change', async () => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  const window = { webContents: new EventEmitter() };
  const token = '10000000-0000-4000-8000-000000000000',
    request = { token, time: 78 };
  const invoke = (key: string, data: unknown) =>
    mock.handlers.get(key)?.({}, data);
  registerScrubPreviewHandlers();
  try {
    mock.sender.mockReturnValue(null);
    await expect(invoke(channels.prepare, request)).rejects.toThrow(
      'UNAUTHORIZED',
    );
    mock.sender.mockReturnValue(window);
    mock.session.mockReturnValue({
      mainWindow: window,
      packageBound: true,
      packagePath: 'fixture',
    });
    const assertCurrent = vi.fn().mockResolvedValue(undefined);
    mock.resolve.mockResolvedValue({ assertCurrent });
    let close: () => void = () => {};
    let cancelled = false;
    mock.produce.mockImplementationOnce(
      (_src: unknown, _time: number, signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            cancelled = true;
          });
          close = () => resolve({});
        }),
    );
    const pending = invoke(channels.prepare, request);
    await vi.waitFor(() => expect(mock.produce).toHaveBeenCalledTimes(1));
    await invoke(channels.release, token);
    expect(cancelled).toBe(true);
    expect(await invoke(channels.prepare, request)).toBeNull();
    close();
    expect(await pending).toBeNull();
    mock.produce.mockResolvedValue({ frames: [] });
    expect(await invoke(channels.prepare, request)).toEqual({ frames: [] });
    expect(await invoke(channels.validate, token)).toBe(true);
    assertCurrent.mockRejectedValueOnce(Error('changed'));
    expect(await invoke(channels.validate, token)).toBe(false);
    expect(window.webContents.listenerCount('destroyed')).toBe(0);
  } finally {
    if (original) Object.defineProperty(process, 'platform', original);
  }
});
