import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  getCacheSessionController,
  holdPlaybackCaches,
} from './cacheSessionController';
import type { CacheAuthorizedSource } from './cacheSourceAccess';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: mocks.session,
}));
vi.mock('./cacheSourceAccess', () => ({ resolveCacheSource: mocks.resolve }));
vi.mock('./cacheRuntimePipeline', () => ({
  preparePlaybackCache: mocks.prepare,
  CACHE_LIMITS: { maximumCacheBytes: 10000, reserveBytes: 1000 },
}));
vi.mock('./sourceIdentity', () => ({
  identifyCacheSource: vi.fn(),
  readCacheFileIdentity: vi.fn(),
}));
class WindowDouble extends EventEmitter {
  webContents = new EventEmitter();
  destroyed = false;
  isDestroyed = (): boolean => this.destroyed;
}
const windows: WindowDouble[] = [];
const settle = async (): Promise<void> => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
const fixture = async () => {
  const window = new WindowDouble();
  windows.push(window);
  // This double implements the exact window/event surface the controller uses.
  const native = window as unknown as BrowserWindow;
  const controller = getCacheSessionController(native);
  const snapshot = await controller.inspect();
  const request = {
    generation: snapshot.generation,
    sourceKey: 'a'.repeat(64),
  };
  return { window, native, controller, request };
};
beforeEach(() => {
  mocks.prepare.mockReset();
  mocks.session.mockImplementation((window) => ({
    mainWindow: window,
    packageBound: true,
    packagePath: '/package',
  }));
  const source: CacheAuthorizedSource = {
    key: 'a'.repeat(64),
    path: '/package/source.mp4',
    url: 'file:///package/source.mp4',
    label: 'source.mp4',
    revision: 'revision',
    bytes: 10,
    assertCurrent: async () => undefined,
  };
  mocks.resolve.mockResolvedValue(source);
});
afterEach(async () => {
  for (const window of windows.splice(0)) {
    window.destroyed = true;
    window.emit('closed');
  }
  await settle();
});
it('cancels preflight on reload, refuses stale requests and keeps ownership until it settles', async () => {
  const pending = Promise.withResolvers<never>();
  mocks.prepare.mockReturnValue(pending.promise);
  const { window, controller, request } = await fixture();
  controller.prepare(request);
  await settle();
  const signal: AbortSignal = mocks.prepare.mock.calls[0][0].signal;
  window.webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  expect(signal.aborted).toBe(true);
  expect(() => controller.prepare(request)).toThrow('CACHE_STALE_REQUEST');
  let drained = false;
  const work = controller.drain().then(() => {
    drained = true;
  });
  await settle();
  expect(drained).toBe(false);
  pending.reject(Error('cancelled'));
  await work;
  const next = await controller.inspect();
  expect(next.generation).not.toBe(request.generation);
  expect(next.status.phase).toBe('original');
});
it('holds a close boundary through worker termination and prevents a new generation starting while closing', async () => {
  const pending = Promise.withResolvers<never>();
  mocks.prepare.mockReturnValue(pending.promise);
  const { native, controller, request } = await fixture();
  controller.prepare(request);
  await settle();
  let stopped = false;
  const closing = holdPlaybackCaches([native], 'close').then((release) => {
    stopped = true;
    return release;
  });
  await settle();
  expect(stopped).toBe(false);
  pending.reject(Error('cancelled'));
  const release = await closing;
  expect(() => controller.prepare(request)).toThrow('CACHE_BUSY');
  release();
  mocks.prepare.mockRejectedValue(Error('unsupported'));
  controller.prepare(request);
  await controller.drain();
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
});
it('rejects a replaced Session even when the renderer retains a previous source key', async () => {
  const { controller, request } = await fixture();
  mocks.session.mockReturnValue({
    mainWindow: {},
    packageBound: true,
    packagePath: '/other',
  });
  expect(() => controller.prepare(request)).toThrow('CACHE_OWNER_CHANGED');
  expect(mocks.prepare).not.toHaveBeenCalled();
});

it('prevents quit on failed cleanup and releases the hold so cleanup can be retried', async () => {
  const { PlaybackCacheJob } = await import('./cacheJob');
  let fail = true;
  mocks.prepare.mockImplementation(async (options) => {
    const job = new PlaybackCacheJob(
      {
        capacity: async () => {
          throw Error('capacity');
        },
        convert: vi.fn(),
        validate: vi.fn(),
        publish: vi.fn(),
        discard: async () => {
          if (fail) throw Error('cleanup');
        },
      },
      options.notify,
    );
    options.retainJob(job);
    // Invalid expectation intentionally fails before conversion and exercises cleanup ownership.
    await job.start(
      { source: { sha256: '', bytes: 0 }, recipe: '', runtime: '', timing: {} },
      1,
    );
    throw Error('preparation failed');
  });
  const { native, controller, request } = await fixture();
  controller.prepare(request);
  await controller.drain();
  expect((await controller.inspect()).status.error).toBe('cleanup');
  await expect(holdPlaybackCaches([native], 'quit')).rejects.toThrow(
    'CACHE_CLEANUP_REQUIRED',
  );
  fail = false;
  await controller.cleanup(request);
  expect((await controller.inspect()).status.error).toBeNull();
  const release = await holdPlaybackCaches([native], 'quit');
  release();
});
