import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CacheHardwareEvidence,
  probeCacheHardware,
} from './cacheHardwareProbe';
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('electron', () => ({
  BrowserWindow: class {
    constructor() {
      return mocks.create();
    }
  },
}));
const roots: string[] = [];
const retained: (() => Promise<void>)[] = [];
const goodProperties = {
  playerId: 'owned',
  properties: [
    { name: 'kIsPlatformVideoDecoder', value: 'true' },
    { name: 'kVideoDecoderName', value: 'VideoToolboxVideoDecoder' },
  ],
};
class WindowDouble extends EventEmitter {
  destroyed = false;
  delayClose = false;
  debugger = Object.assign(new EventEmitter(), {
    attach: vi.fn(),
    isAttached: () => true,
    detach: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue(undefined),
  });
  webContents = Object.assign(new EventEmitter(), {
    debugger: this.debugger,
    setWindowOpenHandler: vi.fn(),
    session: {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
    },
    executeJavaScript: vi.fn().mockResolvedValue({
      ended: true,
      failed: false,
      frames: 60,
      maximumTime: 1.9,
    }),
  });
  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn(async () => {
    this.debugger.emit(
      'message',
      {},
      'Media.playerPropertiesChanged',
      goodProperties,
    );
  });
  isDestroyed = (): boolean => this.destroyed;
  close = vi.fn(() => {
    if (!this.delayClose) this.finishClose();
  });
  finishClose(): void {
    this.destroyed = true;
    this.emit('closed');
  }
}
const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-hardware-test-'));
  roots.push(root);
  const window = new WindowDouble();
  mocks.create.mockReturnValue(window);
  const signal = new AbortController();
  const run = () =>
    probeCacheHardware(
      path.join(root, 'media.mp4'),
      root,
      'same-runtime',
      signal.signal,
      vi.fn(),
      (cleanup) => retained.push(cleanup),
    );
  return { window, run, signal };
};
beforeEach(() => {
  vi.clearAllMocks();
  retained.length = 0;
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of retained) await cleanup();
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});
it('requires one observed hardware player and rejects any software fallback', () => {
  const proof = new CacheHardwareEvidence();
  proof.observe('Media.playerPropertiesChanged', goodProperties);
  expect(proof.finish('runtime').platformDecoder).toBe(true);
  proof.observe('Media.playerPropertiesChanged', {
    playerId: 'owned',
    properties: [{ name: 'kIsPlatformVideoDecoder', value: 'false' }],
  });
  expect(() => proof.finish('runtime')).toThrow();
});
it('closes the isolated probe before returning and retains idempotent cleanup', async () => {
  const { window, run } = await fixture();
  await expect(run()).resolves.toMatchObject({
    runtime: 'same-runtime',
    platformDecoder: true,
    softwareFallback: false,
    probe: {
      ended: true,
      frames: 60,
      maximumTime: 1.9,
      properties: [
        { playerId: 'owned', name: 'kIsPlatformVideoDecoder', value: 'true' },
        {
          playerId: 'owned',
          name: 'kVideoDecoderName',
          value: 'VideoToolboxVideoDecoder',
        },
      ],
    },
  });
  expect(window.close).toHaveBeenCalledOnce();
  expect(retained).toHaveLength(1);
});
it('rejects debugger loss and waits for close before removing its files', async () => {
  const { window, run } = await fixture();
  window.delayClose = true;
  window.webContents.executeJavaScript.mockImplementation(async () => {
    window.debugger.emit('detach');
    return { ended: false, failed: false };
  });
  let settled = false;
  const work = run();
  const rejection = expect(work).rejects.toThrow(
    'CACHE_HARDWARE_OBSERVER_LOST',
  );
  void work.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await vi.waitFor(() => expect(window.close).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  window.finishClose();
  await rejection;
});
it('keeps failed temp cleanup reachable for an explicit job cleanup retry', async () => {
  const { run } = await fixture();
  const unlink = vi
    .spyOn(fs, 'unlink')
    .mockRejectedValueOnce(Error('test cleanup failure'));
  await expect(run()).rejects.toThrow('test cleanup failure');
  unlink.mockRestore();
  expect(retained).toHaveLength(1);
  await retained[0]();
});

it('retains empty-directory cleanup when probe initialization cannot obtain an identity', async () => {
  const { run, window } = await fixture();
  const stat = vi
    .spyOn(fs, 'lstat')
    .mockRejectedValueOnce(Error('initialization failed'));
  await expect(run()).rejects.toThrow('initialization failed');
  expect(window.loadURL).not.toHaveBeenCalled();
  expect(retained).toHaveLength(1);
  stat.mockRestore();
  await retained[0]();
});

it('keeps evidence snapshots isolated and rejects truncated hardware history', () => {
  const proof = new CacheHardwareEvidence();
  proof.observe('Media.playerPropertiesChanged', goodProperties);
  proof.snapshot()[0].value = 'false';
  expect(proof.snapshot()[0].value).toBe('true');
  for (let index = 0; index < 256; index++)
    proof.observe('Media.playerPropertiesChanged', goodProperties);
  expect(proof.snapshot()).toHaveLength(512);
  expect(() => proof.finish('runtime')).toThrow('CACHE_HARDWARE_UNCONFIRMED');
});
