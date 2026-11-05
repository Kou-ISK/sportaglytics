import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { registerCommandLeftApplication } from './commandLeftApplication';
const mocks = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), register: vi.fn(), app: null as unknown }));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  const app = Object.assign(new EventEmitter(), { isPackaged: true, whenReady: async () => {}, getPath: () => '/synthetic' });
  mocks.app = app;
  return { app, BrowserWindow: { getFocusedWindow: () => null } };
});
vi.mock('./commandLeftStartup', () => ({ loadSignedCommandLeftMonitor: mocks.load }));
vi.mock('./commandLeftMain', () => ({ createCommandLeftMain: mocks.create }));
vi.mock('./commandLeftIpc', () => ({ registerCommandLeftIpc: mocks.register }));
const tick = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
afterEach(() => { vi.resetAllMocks(); (mocks.app as EventEmitter).removeAllListeners(); });
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')('registers only after signed loading and monitor startup, then disposes at quit', async () => {
  const input = { start: vi.fn(() => true), dispose: vi.fn() };
  mocks.load.mockResolvedValue({ synthetic: true }); mocks.create.mockReturnValue(input);
  registerCommandLeftApplication(); await tick();
  expect(mocks.load).toHaveBeenCalledOnce(); expect(mocks.register).toHaveBeenCalledOnce();
  await expect(mocks.register.mock.calls[0][0]).resolves.toBe(input);
  (mocks.app as EventEmitter).emit('will-quit'); expect(input.dispose).toHaveBeenCalledOnce();
});
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')('does not register input if signature verification fails', async () => {
  mocks.load.mockRejectedValue(Error('SIGNATURE_INVALID'));
  registerCommandLeftApplication(); await tick();
  expect(mocks.create).not.toHaveBeenCalled();
  await expect(mocks.register.mock.calls[0][0]).resolves.toBeNull();
});
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')('registers a waiting endpoint before signature verification completes', async () => {
  const load = Promise.withResolvers<unknown>(); const input = { start: () => true, dispose: vi.fn() };
  mocks.load.mockReturnValue(load.promise); mocks.create.mockReturnValue(input);
  registerCommandLeftApplication();
  expect(mocks.register).toHaveBeenCalledOnce(); await tick();
  let resolved = false; void mocks.register.mock.calls[0][0].then(() => { resolved = true; });
  await tick(); expect(resolved).toBe(false);
  load.resolve({}); await expect(mocks.register.mock.calls[0][0]).resolves.toBe(input);
});
