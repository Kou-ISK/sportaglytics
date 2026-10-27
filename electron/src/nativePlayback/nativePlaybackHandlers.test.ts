import { beforeEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { getRendererUrl } from '../rendererUrl';
import {
  nativePlaybackChannels as channels,
  parseNativePlaybackAvailability,
  nativePlaybackSnapshotChannel,
} from '../../../src/types/ipc/nativePlayback';
import {
  registerNativePlaybackHandlers,
  holdNativePlayback,
} from './nativePlaybackHandlers';
import type { NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
const mocks = vi.hoisted(() => ({
  acknowledgement: vi.fn(),
  handlers: new Map<string, (event: unknown, raw?: unknown) => unknown>(),
  fromWebContents: vi.fn(),
  session: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  ipcMain: {
    on: (_name: string, fn: unknown) => mocks.acknowledgement(fn),
    handle: (name: string, fn: (event: unknown, raw?: unknown) => unknown) =>
      mocks.handlers.set(name, fn),
  },
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: mocks.session,
}));
const call = async (name: string, event: unknown, raw?: unknown) => {
  const handler = mocks.handlers.get(name);
  if (!handler) throw Error('missing handler');
  return handler(event, raw);
};
const fixture = () => {
  const frame = { url: getRendererUrl() };
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    getURL: () => frame.url,
    isDestroyed: () => false,
    send: vi.fn(),
  });
  const window = Object.assign(new EventEmitter(), {
    webContents: sender,
    isDestroyed: () => false,
  });
  const event = { sender, senderFrame: frame };
  mocks.fromWebContents.mockReturnValue(window);
  mocks.session.mockReturnValue({
    id: 'synthetic',
    packagePath: '/synthetic.stpkg',
    packageBound: true,
    mainWindow: window,
  });
  return { window, event, frame };
};
let lastOwner: NativePlaybackOwner | null = null;
const write = vi.fn(async () => {});
const reportFailure = vi.fn();
const close = vi.fn(async () => ({
  generation: lastOwner?.generation ?? '',
  nativeDrained: true,
  processStarted: true,
  processExited: true,
  pipesClosed: true,
  stopped: null,
}));
let nativeObserve: (value: unknown) => void = () => {};
const createBackend = vi.fn(
  (owner: NativePlaybackOwner, observe: (value: unknown) => void) => {
    nativeObserve = observe;
    lastOwner = owner;
    return { write, close, reportFailure };
  },
);
registerNativePlaybackHandlers(async () => ({
  sourceKey: 'a'.repeat(64),
  sourceUrl: 'file:///synthetic.mp4',
  sourceEnd: null,
  scope: { start: 0, end: 20, audioTracks: 3, rates: [1, 6] },
  assertCurrent: async () => {},
  createBackend,
}));
beforeEach(() => {
  mocks.fromWebContents.mockReset();
  mocks.session.mockReset();
  createBackend.mockClear();
  write.mockClear();
  reportFailure.mockClear();
  close.mockClear();
});
it('rejects foreign documents, subframes and non-owning windows through the real sender guard', async () => {
  const { window, event, frame } = fixture();
  for (const name of Object.values(channels)) {
    await expect(
      call(name, { ...event, senderFrame: { ...frame } }),
    ).rejects.toThrow('NATIVE_UNAUTHORIZED');
    await expect(call(name, { ...event, senderFrame: null })).rejects.toThrow(
      'NATIVE_UNAUTHORIZED',
    );
  }
  frame.url = 'file:///foreign.html';
  await expect(call(channels.inspect, event)).rejects.toThrow(
    'NATIVE_UNAUTHORIZED',
  );
  frame.url = getRendererUrl();
  mocks.session.mockReturnValue({ packageBound: true, mainWindow: {} });
  await expect(call(channels.inspect, event)).rejects.toThrow(
    'NATIVE_UNAUTHORIZED',
  );
  mocks.session.mockReturnValue({ packageBound: false, mainWindow: window });
  await expect(call(channels.inspect, event)).rejects.toThrow(
    'NATIVE_UNAUTHORIZED',
  );
  expect(createBackend).not.toHaveBeenCalled();
});
it.skipIf(process.platform !== 'darwin')(
  'validates payloads, retains one owner, and drains before releasing shutdown',
  async () => {
    const { event } = fixture();
    const available = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    if (!available.owner) throw Error('owner');
    await expect(
      call(channels.open, event, { ...available.owner, path: '/outside.mp4' }),
    ).rejects.toThrow();
    expect(createBackend).not.toHaveBeenCalled();
    await call(channels.open, event, available.owner);
    const intent = {
      ...available.owner,
      sequence: 1,
      seekId: 1,
      targetTime: 3,
      playing: false,
      rate: 6,
      audioTrack: 0,
      volume: 0.5,
      muted: true,
    };
    for (const changes of [
      { rate: 7 },
      { audioTrack: -1 },
      { targetTime: NaN },
      { sequence: 0 },
      { sourceKey: 'wrong' },
      { executable: 'foreign' },
    ])
      await expect(
        call(channels.apply, event, { ...intent, ...changes }),
      ).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
    await call(channels.apply, event, intent);
    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    await expect(
      call(channels.close, event, {
        ...available.owner,
        generation: 'foreign',
      }),
    ).rejects.toThrow('NATIVE_OWNER_CHANGED');
    const release = await holdNativePlayback([], 'quit');
    await expect(call(channels.inspect, event)).rejects.toThrow(
      'NATIVE_CLOSING',
    );
    expect(close).toHaveBeenCalledOnce();
    release();
    const next = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    expect(next.available).toBe(true);
  },
);

it.skipIf(process.platform !== 'darwin')(
  'clears global native ownership after navigation has drained the old generation',
  async () => {
    const { event, window } = fixture();
    const first = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    if (!first.owner) throw Error('owner');
    await call(channels.open, event, first.owner);
    window.webContents.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: false,
    });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    const next = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    if (!next.owner) throw Error('next owner');
    expect(next.owner.generation).not.toBe(first.owner.generation);
    await call(channels.open, event, next.owner);
    expect(createBackend).toHaveBeenCalledTimes(2);
    await call(channels.close, event, next.owner);
  },
);

it.skipIf(process.platform !== 'darwin')(
  'only a trusted owning main frame can acknowledge bounded snapshot delivery',
  async () => {
    const { event, window, frame } = fixture();
    const available = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    if (!available.owner) throw Error('owner');
    await call(channels.open, event, available.owner);
    const intent = {
      ...available.owner,
      sequence: 1,
      seekId: 1,
      targetTime: 3,
      playing: false,
      rate: 1,
      audioTrack: 0,
      volume: 0.5,
      muted: true,
    };
    await call(channels.apply, event, intent);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const observation = {
      ...available.owner,
      sequence: 1,
      seekId: 1,
      revision: 1,
      phase: 'paused',
      time: 3,
      rate: 0,
      audioTrack: 0,
      volume: 0.5,
      muted: true,
      videoReady: true,
      audioReady: true,
      error: null,
    };
    nativeObserve(observation);
    nativeObserve({ ...observation, revision: 2 });
    expect(window.webContents.send).toHaveBeenCalledTimes(1);
    const notice = window.webContents.send.mock.calls[0];
    expect(notice[0]).toBe(nativePlaybackSnapshotChannel);
    const callback: unknown = mocks.acknowledgement.mock.calls[0][0];
    if (typeof callback !== 'function') throw Error('ack handler');
    callback(
      { ...event, senderFrame: { ...frame } },
      { owner: available.owner, delivery: notice[1].delivery },
    );
    expect(window.webContents.send).toHaveBeenCalledTimes(1);
    callback(event, { owner: available.owner, delivery: notice[1].delivery });
    expect(window.webContents.send).toHaveBeenCalledTimes(2);
    expect(
      window.webContents.send.mock.calls[1][1].snapshot.observation.revision,
    ).toBe(2);
    await call(channels.close, event, available.owner);
  },
);

it.skipIf(process.platform !== 'darwin')(
  'accepts one numeric post-close report through validated IPC',
  async () => {
    const { event } = fixture();
    const available = parseNativePlaybackAvailability(
      await call(channels.inspect, event),
    );
    if (!available.owner) throw Error('owner');
    await call(channels.open, event, available.owner);
    await call(channels.close, event, available.owner);
    const failure = {
      stage: 2,
      code: 26,
      sequence: 1,
      seekId: 1,
      targetTime: 3,
      confirmedTime: 3,
    };
    for (const change of [
      { path: '/secret' },
      { code: 37 },
      { stage: 0 },
      { sequence: 1.5 },
      { seekId: 0 },
      { targetTime: Infinity },
      { confirmedTime: -1 },
    ]) {
      await expect(
        call(channels.reportFailure, event, {
          owner: available.owner,
          failure: { ...failure, ...change },
        }),
      ).rejects.toThrow();
    }
    await call(channels.reportFailure, event, {
      owner: available.owner,
      failure,
    });
    await call(channels.reportFailure, event, {
      owner: available.owner,
      failure,
    });
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure);
    expect(close).toHaveBeenCalledTimes(1);
  },
);
