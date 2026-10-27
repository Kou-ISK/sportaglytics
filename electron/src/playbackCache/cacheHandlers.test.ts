import { expect, it, vi } from 'vitest';
import { registerPlaybackCacheHandlers } from './cacheHandlers';
import { createPlaybackCacheBridge } from '../preload/playbackCacheBridge';
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw?: unknown) => unknown>(),
  sender: vi.fn(),
  session: vi.fn(),
  reuse: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      channel: string,
      callback: (event: unknown, raw?: unknown) => unknown,
    ) => mocks.handlers.set(channel, callback),
  },
}));
vi.mock('../ipc/windowSenderGuards', () => ({
  getValidatedEventSenderWindow: mocks.sender,
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: mocks.session,
}));
vi.mock('./cacheSessionController', () => ({
  getCacheSessionController: () => ({
    reuse: mocks.reuse,
    prepare: mocks.prepare,
  }),
}));
it('keeps reuse behind the validated sender, exact request and dedicated bridge', async () => {
  registerPlaybackCacheHandlers();
  const handler = mocks.handlers.get('playback-cache:reuse');
  if (!handler) throw Error('missing handler');
  const request = {
    generation: '11111111-1111-4111-8111-111111111111',
    sourceKey: 'a'.repeat(64),
  };
  const window = {};
  mocks.sender.mockReturnValue(null);
  expect(() => handler({}, request)).toThrow('CACHE_UNAUTHORIZED');
  mocks.sender.mockReturnValue(window);
  mocks.session.mockReturnValue({ packageBound: true, mainWindow: {} });
  expect(() => handler({}, request)).toThrow('CACHE_UNAUTHORIZED');
  mocks.session.mockReturnValue({ packageBound: true, mainWindow: window });
  expect(() =>
    handler({}, { ...request, path: '/outside/media.mp4' }),
  ).toThrow();
  expect(mocks.reuse).not.toHaveBeenCalled();
  const invoke = vi.fn(async (channel: string, raw: unknown) => {
    expect(channel).toBe('playback-cache:reuse');
    return handler({}, raw);
  });
  await createPlaybackCacheBridge({ invoke }).reuse(request);
  expect(mocks.reuse).toHaveBeenCalledExactlyOnceWith(request);
  expect(mocks.prepare).not.toHaveBeenCalled();
});
