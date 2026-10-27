// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNativeCacheActions } from './useNativeCacheActions';
import type { usePlaybackCacheController } from './usePlaybackCacheController';
const mocks = vi.hoisted(() => ({ get: vi.fn(), restore: vi.fn() }));
vi.mock('../../shared/nativePlayback/nativePlaybackRegistry', () => ({
  getNativePlayback: mocks.get,
  restoreNativeBeforeDocumentChange: mocks.restore,
}));
afterEach(() => vi.resetAllMocks());
const fixture = (): ReturnType<typeof usePlaybackCacheController> => ({
  context: { register: () => () => {} },
  snapshot: {
    generation: 'document',
    available: true,
    maximumCacheBytes: 1024,
    reserveBytes: 1024,
    source: {
      key: 'a'.repeat(64),
      url: 'file:///synthetic.mp4',
      label: 'Synthetic',
      audioTracks: 1,
    },
    status: {
      phase: 'ready',
      selected: 'original',
      progress: null,
      error: null,
    },
  },
  error: null,
  switching: false,
  onPrepare: vi.fn(),
  onReuse: vi.fn(),
  onCancel: vi.fn(),
  onRetryCleanup: vi.fn(),
  onUseCache: vi.fn(),
  onUseOriginal: vi.fn(),
  onRetryOriginal: null,
});
it('drains native before an existing cache request and deduplicates pending requests', async () => {
  const cache = fixture();
  mocks.get.mockReturnValue({ sourceUrl: 'file:///synthetic.mp4' });
  const pending = Promise.withResolvers<void>();
  mocks.restore.mockReturnValue(pending.promise);
  const hook = renderHook(() => useNativeCacheActions(cache));
  act(() => {
    hook.result.current.onUseCache();
    hook.result.current.onUseCache();
  });
  expect(cache.onUseCache).not.toHaveBeenCalled();
  expect(mocks.restore).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve());
  await waitFor(() => expect(cache.onUseCache).toHaveBeenCalledTimes(1));
  expect(hook.result.current.switching).toBe(false);
  hook.unmount();
});
it('does not transfer a queued cache request to a different document', async () => {
  const cache = fixture();
  mocks.get.mockReturnValue({ sourceUrl: 'file:///synthetic.mp4' });
  const pending = Promise.withResolvers<void>();
  mocks.restore.mockReturnValue(pending.promise);
  const hook = renderHook(({ value }) => useNativeCacheActions(value), {
    initialProps: { value: cache },
  });
  act(() => hook.result.current.onUseCache());
  hook.rerender({ value: { ...cache, snapshot: null } });
  await act(async () => pending.resolve());
  expect(cache.onUseCache).not.toHaveBeenCalled();
  hook.unmount();
});
it('keeps a failed native recovery stopped and reports the blocked cache transition', async () => {
  const cache = fixture();
  mocks.get.mockReturnValue({ sourceUrl: 'file:///synthetic.mp4' });
  mocks.restore.mockRejectedValue(Error('uncertain drain'));
  const hook = renderHook(() => useNativeCacheActions(cache));
  act(() => hook.result.current.onUseCache());
  await waitFor(() =>
    expect(hook.result.current.error).toContain('復旧を確認できない'),
  );
  expect(cache.onUseCache).not.toHaveBeenCalled();
  hook.unmount();
});
