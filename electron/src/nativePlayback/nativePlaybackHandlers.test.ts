import { beforeEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { getRendererUrl } from '../rendererUrl';
import { createCommandLeftMain } from '../nativeInput/commandLeftMain';
import { registerCommandLeftIpc } from '../nativeInput/commandLeftIpc';
import { createNativePlaybackBridge } from '../preload/nativePlaybackBridge';
import { createNativeCommandLeftBridge } from '../preload/nativeCommandLeftBridge';
import { NativePlaybackController } from '../../../src/features/videoPlayer/shared/nativePlayback/nativePlaybackController';
import { createCommandGestureAdapter } from '../../../src/features/videoPlayer/shared/nativePlayback/commandGestureAdapter';
import type { IpcRenderer } from 'electron';
import {
  nativePlaybackChannels as channels,
  parseNativePlaybackAvailability,
  nativePlaybackSnapshotChannel,
  nativePlaybackSnapshotAckChannel,
} from '../../../src/types/ipc/nativePlayback';
import {
  registerNativePlaybackHandlers,
  holdNativePlayback,
  captureNativeGestureOwner,
} from './nativePlaybackHandlers';
import type { NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
const mocks = vi.hoisted(() => ({
  acknowledgement: vi.fn(),
  listeners: new Map<string, (event: unknown, raw: unknown) => void>(),
  handlers: new Map<string, (event: unknown, raw?: unknown) => unknown>(),
  fromWebContents: vi.fn(),
  session: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  ipcMain: {
    on: (name: string, fn: (event: unknown, raw: unknown) => void) => {
      mocks.acknowledgement(fn);
      mocks.listeners.set(name, fn);
    },
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
    getNativeWindowHandle: () => Buffer.alloc(8),
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
const sourceCheck = vi.fn(async () => {});
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

it.skipIf(process.platform !== 'darwin')('connects real Renderer gesture handling to Main ownership through preload', async () => {
  const { event, window } = fixture();
  const rendererListeners = new Map<string, (_event: unknown, value: unknown) => void>();
  let snapshotListener: ((value: unknown) => void) | undefined;
  let releaseNormalization: (() => void) | undefined;
  const normalizationGate = new Promise<void>((resolve) => { releaseNormalization = resolve; });
  window.webContents.send.mockImplementation((channel: string, value: unknown) => {
    queueMicrotask(() => {
      if (channel === nativePlaybackSnapshotChannel) snapshotListener?.(value);
      else rendererListeners.get(channel)?.({}, value);
    });
  });
  const snapshotAck = vi.fn((value: unknown) => mocks.listeners.get(nativePlaybackSnapshotAckChannel)?.(event, value));
  const playback = createNativePlaybackBridge({
    invoke: async (channel, raw) => {
      if (channel === channels.apply && typeof raw === 'object' && raw !== null &&
          'sequence' in raw && raw.sequence === 4) await normalizationGate;
      return call(channel, event, raw);
    },
    subscribe: (listener) => { snapshotListener = listener; return () => { snapshotListener = undefined; }; },
    acknowledge: snapshotAck,
  });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
    reset: () => 0, stop: () => {}, matchesWindow: () => true,
    health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
  const main = createCommandLeftMain(monitor, () => window);
  expect(main.start()).toBe(true);
  registerCommandLeftIpc(main);
  const send = vi.fn((channel: string, raw: unknown) => mocks.listeners.get(channel)?.(event, raw));
  const ipc = {
    invoke: async (channel: string, raw?: unknown) => call(channel, event, raw),
    send,
    on: (channel: string, listener: (_event: unknown, value: unknown) => void) => { rendererListeners.set(channel, listener); },
    removeListener: (channel: string) => { rendererListeners.delete(channel); },
  } as unknown as IpcRenderer;
  const command = createNativeCommandLeftBridge(ipc);
  const available = await playback.inspect();
  if (!available.owner) throw Error('owner');
  const owner = available.owner;
  const original = { pause: vi.fn(), restore: vi.fn(async () => {}), release: vi.fn(), restored: vi.fn() };
  const controller = new NativePlaybackController(playback, owner, 'file:///synthetic.mp4', 3,
    { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true }, original);
  const errors: unknown[] = [];
  let adapter: ReturnType<typeof createCommandGestureAdapter> | undefined;
  const unsubscribe = command.onEvent((value) => value !== null && (adapter?.receive(value) ?? false));
  try {
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 1 })));
    const observe = (sequence: number, revision: number, playing: boolean): void => nativeObserve({
      ...owner, sequence, seekId: 1, revision, phase: playing ? 'playing' : 'paused',
      time: sequence === 1 ? 3 : sequence === 2 ? 2.95 : sequence < 5 ? 2.9 : sequence === 5 ? 2.85 : 2.8,
      rate: playing ? -6 : 0,
      audioTrack: 0, volume: 0.5, muted: true, videoReady: true, audioReady: true, error: null,
      reverseCapabilities: { slow: true, fast: true },
    });
    observe(1, 1, false);
    await vi.waitFor(() => expect(controller.supportsReverse(6)).toBe(true));
    const epoch = await command.ready();
    if (epoch === null || !input.callback) throw Error('input');
    adapter = createCommandGestureAdapter({ api: command, epoch, current: () => controller,
      onControls: vi.fn(), onFailure: (error) => { errors.push(error); } });
    const down = { phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
      meta: true, shift: false, alt: false, control: false };
    expect(input.callback(down)).toBe(true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 2, playing: true, rate: -6 })));
    observe(2, 2, true);
    expect(input.callback({ ...down, phase: 'up', serial: 2 })).toBe(true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 3, playing: false, rate: -6 })));
    expect(main.retire(window, 1, epoch)).toBe(false);
    // Simulated backend reports ready only after the test's simulated Drawn ACK;
    // this does not exercise a GPU or real native video output.
    observe(3, 3, false);
    await vi.waitFor(() => expect(controller.requestedControls.rate).toBe(1));
    expect(input.callback({ ...down, gesture: 2, serial: 3 })).toBe(true);
    expect(input.callback({ ...down, phase: 'up', gesture: 2, serial: 4 })).toBe(true);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith('native-command-left:acknowledgement', { epoch, serial: 4, accepted: true }));
    expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ sequence: 5 }));
    releaseNormalization?.();
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 4, playing: false, rate: 1 })));
    observe(4, 4, false);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 5, playing: true, rate: -6 })));
    observe(5, 5, true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 6, playing: false, rate: -6 })));
    observe(6, 6, false);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 7, playing: false, rate: 1 })));
    for (let serial = 1; serial <= 4; serial++)
      expect(send).toHaveBeenCalledWith('native-command-left:acknowledgement', { epoch, serial, accepted: true });
    expect(snapshotAck).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(errors).toEqual([]);
    expect(close).not.toHaveBeenCalled();
    observe(7, 7, false);
    await vi.waitFor(() => expect(controller.snapshot().time).toBe(2.8));
    expect(input.callback({ ...down, gesture: 3, serial: 5 })).toBe(true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({ sequence: 8, playing: true, rate: -6 })));
    close.mockResolvedValueOnce({ generation: owner.generation, nativeDrained: true,
      processStarted: true, processExited: true, pipesClosed: true,
      stopped: { ...owner, sequence: 8, seekId: 1, time: 2.8, rate: 0 } });
    controller.seek(9);
    await vi.waitFor(() => expect(original.restored).toHaveBeenCalledWith(9, expect.objectContaining({ playing: false })));
    expect(controller.snapshot().phase).toBe('original');
    expect(original.release).toHaveBeenCalledOnce();
    expect(errors).toEqual([]);
    expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ targetTime: 9 }));
  } finally {
    unsubscribe();
    try { await controller.closeNative(); } catch { /* mock backend may not report a stop clock */ }
    main.dispose();
    await call(channels.close, event, owner).catch(() => {});
  }
});
registerNativePlaybackHandlers(async () => ({
  sourceKey: 'a'.repeat(64),
  sourceUrl: 'file:///synthetic.mp4',
  sourceEnd: null,
  scope: { start: 0, end: 20, audioTracks: 3, rates: [1, 6, -6] },
  assertCurrent: sourceCheck,
  createBackend,
}));
beforeEach(() => {
  mocks.fromWebContents.mockReset();
  mocks.session.mockReset();
  createBackend.mockClear();
  write.mockClear();
  reportFailure.mockClear();
  close.mockClear();
  sourceCheck.mockReset().mockResolvedValue(undefined);
});
it.skipIf(process.platform !== 'darwin')('rejects a start whose input acknowledgement expired during source validation', async () => {
  let now = 100; const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { event, window } = fixture();
  try {
    const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
    if (!available.owner) throw Error('owner');
    await call(channels.open, event, available.owner);
    const base = { ...available.owner, seekId: 1, targetTime: 3, audioTrack: 0, volume: 0.5, muted: true };
    await call(channels.apply, event, { ...base, sequence: 1, playing: false, rate: 1 });
    const input: { callback?: (raw: unknown) => boolean } = {};
    const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
      reset: () => 0, stop: () => {}, matchesWindow: () => true,
      health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
    const main = createCommandLeftMain(monitor, () => window); expect(main.start()).toBe(true);
    const epoch = main.arm(window); if (epoch === null || !input.callback) throw Error('input');
    input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
      meta: true, shift: false, alt: false, control: false });
    expect(main.claim(window, 1, epoch)).toBe('active');
    const checking = Promise.withResolvers<void>(); sourceCheck.mockReturnValueOnce(checking.promise);
    const work = main.apply(window, 1, epoch, { ...base, sequence: 2, playing: true, rate: -6 });
    const rejected = expect(work).rejects.toThrow(); now = 1700; checking.resolve(); await rejected;
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ sequence: 2 }));
    expect(close).toHaveBeenCalledOnce(); main.dispose();
  } finally { clock.mockRestore(); }
});
it.skipIf(process.platform !== 'darwin')('connects monitor failure to the real Main captured owner', async () => {
  const { event, window } = fixture();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  await call(channels.apply, event, { ...available.owner, sequence: 1, seekId: 1,
    targetTime: 3, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
    reset: () => 0, stop: vi.fn(), matchesWindow: () => true,
    health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
  const main = createCommandLeftMain(monitor, () => window);
  expect(main.start()).toBe(true);
  const epoch = main.arm(window);
  if (epoch === null || !input.callback) throw Error('input');
  expect(input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(main.claim(window, 1, epoch)).toBe('active');
  await main.apply(window, 1, epoch, { ...available.owner, sequence: 2, seekId: 1,
    targetTime: 3, playing: true, rate: -6, audioTrack: 0, volume: 0.5, muted: true });
  expect(input.callback({ phase: 'up', gesture: 1, serial: 2, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(input.callback({ phase: 'down', gesture: 2, serial: 3, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(input.callback({ phase: 'up', gesture: 2, serial: 4, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(main.retire(window, 2, epoch)).toBe(true);
  expect(input.callback({ bad: true })).toBe(false);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(close).toHaveBeenCalledOnce();
  expect(main.arm(window)).toBeNull();
  main.dispose();
});
it.skipIf(process.platform !== 'darwin')('drains the captured owner if Renderer never acknowledges input', async () => {
  vi.useFakeTimers();
  try {
    const { event, window } = fixture();
    const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
    if (!available.owner) throw Error('owner');
    await call(channels.open, event, available.owner);
    await call(channels.apply, event, { ...available.owner, sequence: 1, seekId: 1,
      targetTime: 3, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
    const input: { callback?: (raw: unknown) => boolean } = {};
    const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
      reset: () => 0, stop: () => {}, matchesWindow: () => true,
      health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
    const main = createCommandLeftMain(monitor, () => window); expect(main.start()).toBe(true);
    const epoch = main.arm(window); if (epoch === null || !input.callback) throw Error('input');
    input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
      meta: true, shift: false, alt: false, control: false });
    expect(main.claim(window, 1, epoch)).toBe('active');
    await vi.advanceTimersByTimeAsync(1501);
    expect(close).toHaveBeenCalledOnce(); expect(main.arm(window)).toBeNull(); main.dispose();
  } finally { vi.useRealTimers(); }
});
it.skipIf(process.platform !== 'darwin')('accepts only the matching input acknowledgement before its deadline', async () => {
  vi.useFakeTimers();
  try {
    const { event, window } = fixture();
    const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
    if (!available.owner) throw Error('owner');
    await call(channels.open, event, available.owner);
    await call(channels.apply, event, { ...available.owner, sequence: 1, seekId: 1,
      targetTime: 3, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
    const input: { callback?: (raw: unknown) => boolean } = {};
    const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
      reset: () => 0, stop: () => {}, matchesWindow: () => true,
      health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
    const main = createCommandLeftMain(monitor, () => window); expect(main.start()).toBe(true);
    const epoch = main.arm(window); if (epoch === null || !input.callback) throw Error('input');
    input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
      meta: true, shift: false, alt: false, control: false });
    main.acknowledge(window, epoch, 1, true);
    main.acknowledge(window, epoch, 1, true); // Duplicate is harmless.
    await vi.advanceTimersByTimeAsync(1501);
    expect(main.arm(window)).toBe(epoch);
    expect(close).not.toHaveBeenCalled(); main.dispose();
    await call(channels.close, event, available.owner);
  } finally { vi.useRealTimers(); }
});
it.skipIf(process.platform !== 'darwin')('rejects an ordinary different seek before it can reach a captured host', async () => {
  const { event, window } = fixture();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  const base = { ...available.owner, seekId: 1, targetTime: 3, audioTrack: 0, volume: 0.5, muted: true };
  await call(channels.apply, event, { ...base, sequence: 1, playing: false, rate: 1 });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
    reset: () => 0, stop: () => {}, matchesWindow: () => true,
    health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
  const main = createCommandLeftMain(monitor, () => window);
  expect(main.start()).toBe(true);
  const epoch = main.arm(window);
  if (epoch === null || !input.callback) throw Error('input');
  input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false });
  expect(main.claim(window, 1, epoch)).toBe('active');
  await main.apply(window, 1, epoch, { ...base, sequence: 2, playing: true, rate: -6 });
  await expect(call(channels.apply, event, { ...base, sequence: 3, seekId: 2,
    targetTime: 9, playing: false, rate: 1 })).rejects.toThrow('NATIVE_GESTURE_INTERRUPTED');
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ targetTime: 9 }));
  expect(close).toHaveBeenCalledOnce(); main.dispose();
});
it.skipIf(process.platform !== 'darwin')('rejects an ordinary resume once a captured stop is submitted', async () => {
  const { event, window } = fixture();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  const base = { ...available.owner, seekId: 1, targetTime: 3, audioTrack: 0, volume: 0.5, muted: true };
  await call(channels.apply, event, { ...base, sequence: 1, playing: false, rate: 1 });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
    reset: () => 0, stop: () => {}, matchesWindow: () => true,
    health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
  const main = createCommandLeftMain(monitor, () => window); expect(main.start()).toBe(true);
  const epoch = main.arm(window); if (epoch === null || !input.callback) throw Error('input');
  input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false });
  expect(main.claim(window, 1, epoch)).toBe('active');
  await main.apply(window, 1, epoch, { ...base, sequence: 2, playing: true, rate: -6 });
  const stopping = call(channels.apply, event, { ...base, sequence: 3, playing: false, rate: -6 });
  const stopResult = stopping.catch(() => {});
  await expect(call(channels.apply, event, { ...base, sequence: 4, playing: true, rate: -6 }))
    .rejects.toThrow('NATIVE_GESTURE_INTERRUPTED');
  await stopResult; for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ sequence: 4 }));
  expect(close).toHaveBeenCalledOnce(); main.dispose();
});
it.skipIf(process.platform !== 'darwin' || !process.env.COMMAND_LEFT_TEST_ADDON)('drains the real Main owner after a native N-API fault', async () => {
  const file = process.env.COMMAND_LEFT_TEST_ADDON;
  if (!file) throw Error('missing test addon');
  const addon: { start(callback: (raw: unknown) => boolean): void; reset(): number;
    stop(): void; health(): unknown; injectSynthetic(): void } = require(file);
  const { event, window } = fixture();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  await call(channels.apply, event, { ...available.owner, sequence: 1, seekId: 1,
    targetTime: 3, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; addon.start(callback); },
    reset: () => addon.reset(), stop: () => addon.stop(), health: () => addon.health(), matchesWindow: () => true };
  const main = createCommandLeftMain(monitor, () => window);
  expect(main.start()).toBe(true);
  const epoch = main.arm(window);
  if (epoch === null || !input.callback) throw Error('input');
  expect(input.callback({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(main.claim(window, 1, epoch)).toBe('active');
  await main.apply(window, 1, epoch, { ...available.owner, sequence: 2, seekId: 1,
    targetTime: 3, playing: true, rate: -6, audioTrack: 0, volume: 0.5, muted: true });
  // The compiled test addon's synthetic window has no NSWindow: the Main
  // parser must fault rather than accept an unowned native event.
  addon.injectSynthetic();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(close).toHaveBeenCalledOnce();
  expect(main.arm(window)).toBeNull();
  main.dispose();
});
it.skipIf(process.platform !== 'darwin')('captures only the real Main owner and drains it after document invalidation', async () => {
  const { event, window } = fixture();
  expect(captureNativeGestureOwner(window)).toBeNull();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  await call(channels.apply, event, { ...available.owner, sequence: 1, seekId: 1,
    targetTime: 3, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
  const captured = captureNativeGestureOwner(window);
  if (!captured) throw Error('capture');
  expect(captured.owner).toEqual(available.owner);
  expect(captured.isCurrent()).toBe(true);
  expect(captured.stoppedAndDrawn()).toBe(false);
  await expect(captured.apply({ ...available.owner, generation: 'wrong', sequence: 2,
    seekId: 1, targetTime: 3, playing: true, rate: -6,
    audioTrack: 0, volume: 0.5, muted: true }, () => true))
    .rejects.toThrow('NATIVE_GESTURE_REVOKED');
  await call(channels.apply, event, { ...available.owner, sequence: 2, seekId: 2,
    targetTime: 4, playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true });
  await expect(captured.apply({ ...available.owner, sequence: 2, seekId: 1,
    targetTime: 3, playing: true, rate: -6, audioTrack: 0, volume: 0.5, muted: true }, () => true))
    .rejects.toThrow('NATIVE_GESTURE_REVOKED');
  window.webContents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
  expect(captured.isCurrent()).toBe(false);
  expect(await captured.drain()).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  expect(captureNativeGestureOwner(window)).toBeNull();
});
it.skipIf(process.platform !== 'darwin')('retires only the captured gesture after its own stop and drawn observation', async () => {
  const { event, window } = fixture();
  const available = parseNativePlaybackAvailability(await call(channels.inspect, event));
  if (!available.owner) throw Error('owner');
  await call(channels.open, event, available.owner);
  const base = { ...available.owner, seekId: 1, targetTime: 3, audioTrack: 0, volume: 0.5, muted: true };
  await call(channels.apply, event, { ...base, sequence: 1, playing: false, rate: 1 });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  nativeObserve({ ...available.owner, sequence: 1, seekId: 1, revision: 1, phase: 'paused',
    time: 3, rate: 0, audioTrack: 0, volume: 0.5, muted: true,
    videoReady: true, audioReady: true, error: null });
  const input: { callback?: (raw: unknown) => boolean } = {};
  const monitor = { start: (callback: (raw: unknown) => boolean) => { input.callback = callback; },
    reset: () => 0, stop: () => {}, matchesWindow: () => true,
    health: () => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 }) };
  const main = createCommandLeftMain(monitor, () => window);
  expect(main.start()).toBe(true);
  const epoch = main.arm(window);
  if (epoch === null || !input.callback) throw Error('input');
  const down = { phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false };
  expect(input.callback(down)).toBe(true);
  expect(main.claim(window, 1, epoch)).toBe('active');
  expect(input.callback({ ...down, phase: 'up', serial: 2 })).toBe(true);
  expect(main.retire(window, 1, epoch)).toBe(false);
  await main.apply(window, 1, epoch, { ...base, sequence: 2, playing: true, rate: -6 });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await call(channels.apply, event, { ...base, sequence: 3, playing: false, rate: -6 });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  nativeObserve({ ...available.owner, sequence: 3, seekId: 1, revision: 2, phase: 'paused',
    time: 2.9, rate: 0, audioTrack: 0, volume: 0.5, muted: true,
    videoReady: true, audioReady: true, error: null });
  expect(main.retire(window, 1, epoch)).toBe(true);
  main.dispose();
  await call(channels.close, event, available.owner);
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
