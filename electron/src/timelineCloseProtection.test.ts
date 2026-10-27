import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TIMELINE_PERSISTENCE_CHANNELS as channels } from '../../src/types/ipc/timelinePersistence';
import { registerTimelineCloseProtection } from './timelineCloseProtection';

const mocks = vi.hoisted(() => ({
  app: { on: vi.fn(), quit: vi.fn() },
  ipc: { on: vi.fn() },
  dialog: vi.fn().mockResolvedValue({ response: 0 }),
  drain: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('electron', () => ({
  app: mocks.app,
  ipcMain: mocks.ipc,
  dialog: { showMessageBox: mocks.dialog },
}));
vi.mock('./ipc/atomicTextFile', () => ({ drainAtomicTextWrites: mocks.drain }));

const cancellable = () => ({
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
});

class FakeWindow extends EventEmitter {
  webContents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    getURL: () => 'file:///app/index.html',
    send: vi.fn(),
  });
  destroyed = false;
  delayDestruction = false;
  packageOpen = true;
  isDestroyed = (): boolean => this.destroyed;
  close = vi.fn(() => {
    const event = cancellable();
    this.emit('close', event);
    if (event.defaultPrevented) return false;
    if (this.delayDestruction) return true;
    this.finishClose();
    return true;
  });
  finishClose = (): void => {
    this.destroyed = true;
    this.emit('closed');
  };
}

const appEvents = new EventEmitter();
const handlers = new Map<string, (event: unknown, payload: unknown) => void>();
const openWindows: FakeWindow[] = [];
const emit = (
  channel: string,
  window: FakeWindow,
  payload: unknown,
  frame = window.webContents.mainFrame,
) =>
  handlers.get(channel)?.(
    { sender: window.webContents, senderFrame: frame },
    payload,
  );
const request = (window: FakeWindow) => {
  const call = window.webContents.send.mock.calls.findLast(
    ([channel]) => channel === channels.flush,
  );
  if (!call) throw new Error('No flush request');
  return call[1];
};
const ack = (window: FakeWindow, success = true) =>
  emit(channels.ack, window, { ...request(window), success });
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  appEvents.removeAllListeners();
  handlers.clear();
  openWindows.length = 0;
  mocks.app.on.mockImplementation((channel, listener) =>
    appEvents.on(channel, listener),
  );
  mocks.ipc.on.mockImplementation((channel, listener) =>
    handlers.set(channel, listener),
  );
  mocks.drain.mockResolvedValue(undefined);
  mocks.app.quit.mockImplementation(() => {
    const event = cancellable();
    appEvents.emit('before-quit', event);
    if (event.defaultPrevented) return;
    for (const window of openWindows) {
      if (!window.isDestroyed() && !window.close()) return;
    }
  });
});
afterEach(() => vi.useRealTimers());

const fixture = () => {
  const protection = registerTimelineCloseProtection({
    rendererUrl: 'file:///app/index.html',
    timeoutMs: 100,
    requiresPersistence: (window) =>
      openWindows.find((entry) => entry.webContents === window.webContents)
        ?.packageOpen ?? false,
  });
  const add = (register = true) => {
    const window = new FakeWindow();
    openWindows.push(window);
    // This test double implements exactly the Electron surface used by protection.
    protection.protect(window as unknown as BrowserWindow);
    if (register)
      emit(channels.register, window, {
        registrationId: `owner-${openWindows.length}`,
      });
    return window;
  };
  return { add };
};

it('keeps duplicate closes pending until a matching ACK and the queue drain complete', async () => {
  const { add } = fixture();
  const window = add();
  const drain = Promise.withResolvers<void>();
  mocks.drain.mockReturnValue(drain.promise);
  window.close();
  window.close();
  expect(window.webContents.send).toHaveBeenCalledTimes(1);
  expect(window.destroyed).toBe(false);
  ack(window);
  await settle();
  expect(mocks.drain).toHaveBeenCalledOnce();
  expect(window.destroyed).toBe(false);
  drain.resolve();
  await settle();
  expect(window.destroyed).toBe(true);
});

it('keeps editing frozen until delayed native destruction completes', async () => {
  const window = fixture().add();
  window.delayDestruction = true;
  window.close();
  ack(window);
  await settle();
  expect(window.destroyed).toBe(false);
  expect(window.webContents.send).not.toHaveBeenCalledWith(
    channels.resume,
    expect.anything(),
  );
  window.finishClose();
  await settle();
  expect(window.destroyed).toBe(true);
  expect(window.webContents.send).not.toHaveBeenCalledWith(
    channels.resume,
    expect.anything(),
  );
});

it('resumes after beforeunload cancels an accepted close, then requires a new ACK', async () => {
  const window = fixture().add();
  window.delayDestruction = true;
  window.close();
  ack(window);
  const previous = request(window);
  await settle();
  window.webContents.emit('will-prevent-unload', {});
  await settle();
  expect(window.webContents.send).toHaveBeenCalledWith(
    channels.resume,
    previous,
  );
  window.delayDestruction = false;
  window.close();
  expect(request(window).requestId).not.toBe(previous.requestId);
  ack(window);
  await settle();
  expect(window.destroyed).toBe(true);
});

it.each(['failed-save', 'failed-drain', 'ack-timeout', 'drain-timeout'])(
  'cancels close and resumes editing on %s',
  async (mode) => {
    const window = fixture().add();
    if (mode === 'failed-drain')
      mocks.drain.mockRejectedValue(new Error('disk full'));
    if (mode === 'drain-timeout')
      mocks.drain.mockReturnValue(new Promise(() => undefined));
    window.close();
    if (mode !== 'ack-timeout') ack(window, mode !== 'failed-save');
    await settle();
    await vi.advanceTimersByTimeAsync(101);
    expect(window.destroyed).toBe(false);
    expect(window.webContents.send).toHaveBeenCalledWith(
      channels.resume,
      request(window),
    );
    expect(mocks.dialog).toHaveBeenCalledOnce();
  },
);

it('rejects foreign windows, subframes, stale tokens, malformed and duplicate acknowledgements', async () => {
  const { add } = fixture();
  const window = add();
  const foreign = add();
  window.close();
  const payload = { ...request(window), success: true };
  emit(channels.ack, foreign, payload);
  emit(channels.ack, window, payload, {});
  emit(channels.ack, window, { ...payload, requestId: 'stale' });
  emit(channels.ack, window, { ...payload, success: 'true' });
  await settle();
  expect(mocks.drain).not.toHaveBeenCalled();
  ack(window);
  ack(window);
  await settle();
  expect(mocks.drain).toHaveBeenCalledOnce();
  expect(window.destroyed).toBe(true);
  expect(foreign.destroyed).toBe(false);
});

it.each(
  [channels.register, channels.unregister, channels.ack].flatMap((channel) =>
    ['getURL', 'senderFrame', 'mainFrame', 'isDestroyed', 'webContents'].map(
      (property) => ({ channel, property }),
    ),
  ),
)(
  'rejects throwing native sender access without changing pending close: $channel / $property',
  async ({ channel, property }) => {
    const window = fixture().add();
    window.close();
    const contents = window.webContents;
    const event = { sender: contents, senderFrame: contents.mainFrame };
    const payload = { ...request(window), success: true };
    const target =
      property === 'senderFrame'
        ? event
        : property === 'isDestroyed' || property === 'webContents'
          ? window
          : contents;
    const descriptor = Object.getOwnPropertyDescriptor(target, property);
    if (!descriptor)
      throw new Error(`Missing native test property: ${property}`);
    const throwDestroyed = (): never => {
      throw new Error('native object has been destroyed');
    };
    Object.defineProperty(
      target,
      property,
      property === 'getURL' || property === 'isDestroyed'
        ? { ...descriptor, value: throwDestroyed }
        : { configurable: true, get: throwDestroyed },
    );
    try {
      expect(() => handlers.get(channel)?.(event, payload)).not.toThrow();
    } finally {
      Object.defineProperty(target, property, descriptor);
    }
    await settle();
    expect(window.destroyed).toBe(false);
    expect(mocks.drain).not.toHaveBeenCalled();
    expect(mocks.dialog).not.toHaveBeenCalled();
    expect(contents.send).not.toHaveBeenCalledWith(
      channels.resume,
      expect.anything(),
    );
    // The rejected event must neither replace/unregister the owner nor ACK it.
    ack(window);
    await settle();
    expect(mocks.drain).toHaveBeenCalledOnce();
    expect(window.destroyed).toBe(true);
  },
);

it.each(['reload', 'unsubscribe', 'replace'])(
  'invalidates an ACK when its owner changes via %s',
  async (change) => {
    const window = fixture().add();
    window.close();
    const stale = { ...request(window), success: true };
    if (change === 'reload')
      window.webContents.emit('did-start-navigation', {
        isMainFrame: true,
        isSameDocument: false,
      });
    if (change === 'unsubscribe')
      emit(channels.unregister, window, { registrationId: 'owner-1' });
    if (change === 'replace')
      emit(channels.register, window, { registrationId: 'owner-new' });
    emit(channels.ack, window, stale);
    await settle();
    expect(window.destroyed).toBe(false);
    expect(mocks.dialog).toHaveBeenCalledOnce();
  },
);

it('waits for every main window before closing any and resumes all on one failure', async () => {
  const { add } = fixture();
  const first = add(),
    second = add();
  mocks.app.quit();
  ack(first);
  await settle();
  expect(first.destroyed).toBe(false);
  expect(second.destroyed).toBe(false);
  ack(second, false);
  await settle();
  expect(first.destroyed).toBe(false);
  expect(second.destroyed).toBe(false);
  for (const window of [first, second])
    expect(window.webContents.send).toHaveBeenCalledWith(
      channels.resume,
      request(window),
    );
});

it('closes all prepared owners after their successful acknowledgements', async () => {
  const { add } = fixture();
  const first = add(),
    second = add();
  mocks.app.quit();
  ack(first);
  ack(second);
  await settle();
  expect(first.destroyed).toBe(true);
  expect(second.destroyed).toBe(true);
  expect(mocks.app.quit).toHaveBeenCalledTimes(2);
});

it('cancels quit if an external open adds an unprepared main window during saving', async () => {
  const { add } = fixture();
  const first = add();
  mocks.app.quit();
  const newlyOpened = add();
  ack(first);
  await settle();
  expect(first.destroyed).toBe(false);
  expect(newlyOpened.destroyed).toBe(false);
  expect(mocks.dialog).toHaveBeenCalledOnce();
  mocks.app.quit();
  ack(first);
  ack(newlyOpened);
  await settle();
  expect(first.destroyed).toBe(true);
  expect(newlyOpened.destroyed).toBe(true);
});

it.each([true, false])(
  'retries a quit requested during a single close only after successful saving: %s',
  async (success) => {
    const { add } = fixture();
    const first = add(),
      second = add();
    first.close();
    mocks.app.quit();
    expect(second.webContents.send).not.toHaveBeenCalled();
    ack(first, success);
    await settle();
    await vi.advanceTimersByTimeAsync(0);
    if (success) {
      expect(first.destroyed).toBe(true);
      expect(second.webContents.send).toHaveBeenCalledWith(
        channels.flush,
        expect.anything(),
      );
      ack(second);
      await settle();
      expect(second.destroyed).toBe(true);
    } else {
      expect(first.destroyed).toBe(false);
      expect(second.webContents.send).not.toHaveBeenCalled();
    }
  },
);

it('does not retain close authorization after another window cancels quit', async () => {
  const { add } = fixture();
  const first = add(),
    second = add();
  // Model a Playlist window visited first by Electron, whose dirty dialog
  // prevents close. The existing Playlist handler itself is not replaced.
  const playlist = new FakeWindow();
  playlist.on('close', (event) => event.preventDefault());
  openWindows.unshift(playlist);
  mocks.app.quit();
  ack(first);
  ack(second);
  await settle();
  expect(first.destroyed).toBe(false);
  expect(second.destroyed).toBe(false);
  const oldRequest = request(first);
  first.close();
  expect(request(first).requestId).not.toBe(oldRequest.requestId);
  emit(channels.ack, first, { ...oldRequest, success: true });
  await settle();
  expect(first.destroyed).toBe(false);
  ack(first);
  await settle();
  expect(first.destroyed).toBe(true);
});

it('preserves a previous live-capture quit prevention and flushes on its later retry', async () => {
  let recording = true;
  appEvents.on('before-quit', (event) => {
    if (recording) event.preventDefault();
  });
  const window = fixture().add();
  mocks.app.quit();
  expect(window.webContents.send).not.toHaveBeenCalled();
  recording = false;
  mocks.app.quit();
  ack(window);
  await settle();
  expect(window.destroyed).toBe(true);
});

it('allows clean startup close, but keeps an open package alive without its renderer handler', async () => {
  const { add } = fixture();
  const empty = add(false);
  empty.packageOpen = false;
  empty.close();
  await settle();
  expect(empty.destroyed).toBe(true);
  const loading = add(false);
  loading.close();
  await settle();
  expect(loading.destroyed).toBe(false);
  expect(mocks.dialog).toHaveBeenCalledOnce();
});

it('keeps protection during subframe loads and hash routing, and rejects a different main document', async () => {
  const { add } = fixture();
  const window = add(false);
  window.webContents.getURL = () => 'file:///app/index.html#/';
  emit(channels.register, window, { registrationId: 'owner-main' });
  window.webContents.emit('did-start-navigation', {
    isMainFrame: false,
    isSameDocument: false,
  });
  window.webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: true,
  });
  window.close();
  window.webContents.getURL = () => 'file:///other/index.html';
  ack(window);
  await settle();
  expect(mocks.drain).not.toHaveBeenCalled();
  window.webContents.getURL = () => 'file:///app/index.html#/';
  ack(window);
  await settle();
  expect(window.destroyed).toBe(true);
});

it('drains owned background work before requesting persistence and holds creation through native close', async () => {
  const stopped = Promise.withResolvers<() => void>();
  const release = vi.fn();
  const beforeClose = vi.fn(() => stopped.promise);
  const protection = registerTimelineCloseProtection({
    rendererUrl: 'file:///app/index.html',
    requiresPersistence: () => false,
    beforeClose,
  });
  const window = new FakeWindow();
  window.delayDestruction = true;
  // FakeWindow implements only the Electron window surface exercised here.
  protection.protect(window as unknown as BrowserWindow);
  window.close();
  await settle();
  expect(beforeClose).toHaveBeenCalledWith([window], 'close');
  expect(window.webContents.send).not.toHaveBeenCalled();
  expect(window.destroyed).toBe(false);
  stopped.resolve(release);
  await settle();
  expect(release).not.toHaveBeenCalled();
  window.finishClose();
  await settle();
  expect(release).toHaveBeenCalledOnce();
});
it('drains orphaned work on quit even with no surviving protected window', async () => {
  const stopped = Promise.withResolvers<() => void>();
  const release = vi.fn();
  const beforeClose = vi.fn(() => stopped.promise);
  registerTimelineCloseProtection({
    rendererUrl: 'file:///app/index.html',
    requiresPersistence: () => false,
    beforeClose,
  });
  mocks.app.quit();
  await settle();
  expect(mocks.app.quit).toHaveBeenCalledOnce();
  expect(beforeClose).toHaveBeenCalledWith([], 'quit');
  stopped.resolve(release);
  await settle();
  expect(mocks.app.quit).toHaveBeenCalledTimes(2);
  expect(release).toHaveBeenCalledOnce();
});
