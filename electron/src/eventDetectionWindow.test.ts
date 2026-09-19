import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_DETECTION_WINDOW_CHANNELS as channels } from '../../src/types/ipc/eventDetectionWindow';
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  windows: [] as unknown[],
  owners: new Map<unknown, unknown>(),
}));
class FakeWindow extends EventEmitter {
  webContents = { send: vi.fn() };
  destroyed = false;
  isDestroyed = (): boolean => this.destroyed;
  getBounds = (): object => ({ x: 0, y: 0, width: 800, height: 450 });
  isMinimized = (): boolean => false;
  show = vi.fn();
  hide = vi.fn();
  focus = vi.fn();
  restore = vi.fn();
  loadURL = vi.fn();
  setMenuBarVisibility = vi.fn();
  destroy = (): void => {
    this.destroyed = true;
    this.emit('closed');
  };
}
vi.mock('electron', () => ({
  app: { on: vi.fn() },
  BrowserWindow: vi.fn(function () {
    const window = new FakeWindow();
    mocks.windows.push(window);
    return window;
  }),
  screen: {
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 1280, height: 800 },
    }),
  },
  ipcMain: {
    handle: (key: string, handler: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(key, handler),
    on: (key: string, handler: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(key, handler),
  },
}));
vi.mock('./rendererUrl', () => ({ getRendererUrl: (route: string) => route }));
vi.mock('./windowSecurity', () => ({ applyWindowSecurity: vi.fn() }));
vi.mock('./packageSessionRegistry', () => ({
  getPackageSessionForSender: (sender: unknown) => mocks.owners.get(sender),
  registerAuxiliaryWindow: (session: unknown, window: FakeWindow) =>
    mocks.owners.set(window.webContents, session),
  unregisterAuxiliaryWindow: (_session: unknown, window: FakeWindow) =>
    mocks.owners.delete(window.webContents),
}));
const call = (
  channel: string,
  window: FakeWindow,
  payload?: unknown,
): unknown =>
  mocks.handlers.get(channel)?.({ sender: window.webContents }, payload);
const snapshot = {
  open: true,
  loadingModels: false,
  models: [],
  selectedModelKey: '',
  angleOptions: [],
  selectedAngleId: '',
  mappings: [],
  progress: null,
  running: false,
  error: null,
  summary: null,
};

beforeEach(() => {
  vi.resetModules();
  mocks.handlers.clear();
  mocks.windows.length = 0;
  mocks.owners.clear();
});
describe('event detection window session boundary', () => {
  it('isolates snapshots and commands, hides on native close and destroys with its owner', async () => {
    const { registerEventDetectionWindowHandlers } =
      await import('./eventDetectionWindow');
    registerEventDetectionWindowHandlers();
    const owner = new FakeWindow(),
      otherOwner = new FakeWindow();
    mocks.owners.set(owner.webContents, { id: 'one', mainWindow: owner });
    mocks.owners.set(otherOwner.webContents, {
      id: 'two',
      mainWindow: otherOwner,
    });
    call(channels.publish, owner, snapshot);
    call(channels.open, owner);
    const child = mocks.windows[0];
    if (!(child instanceof FakeWindow)) throw new Error('No child window');
    expect(call(channels.request, child)).toEqual(snapshot);
    expect(() => call(channels.request, otherOwner)).toThrow();
    expect(() => call(channels.open, child)).toThrow();
    call(channels.publish, child, { ...snapshot, running: true });
    expect(call(channels.request, child)).toEqual(snapshot);
    call(channels.command, otherOwner, { type: 'run' });
    call(channels.command, child, {
      type: 'mapping',
      eventType: 'lineout',
      updates: { minConfidence: -1 },
    });
    call(channels.command, child, {
      type: 'mapping',
      eventType: 'lineout',
      updates: { constructor: 'unexpected' },
    });
    expect(owner.webContents.send).not.toHaveBeenCalled();
    call(channels.command, child, { type: 'run' });
    expect(owner.webContents.send).toHaveBeenCalledWith(channels.command, {
      type: 'run',
    });
    expect(otherOwner.webContents.send).not.toHaveBeenCalled();
    const preventDefault = vi.fn();
    child.emit('close', { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(child.hide).toHaveBeenCalledOnce();
    call(channels.open, owner);
    expect(mocks.windows).toHaveLength(1);
    expect(child.focus).toHaveBeenCalledOnce();
    owner.destroy();
    expect(child.isDestroyed()).toBe(true);
  });
});
