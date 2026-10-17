// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as gateway from '../gateway/packageGateway';
import { useStartPackageOpen } from './useStartPackageOpen';

vi.mock('../gateway/packageGateway', () => ({
  pickPackagePath: vi.fn(),
  loadPackageDirectory: vi.fn(),
  releasePackageSessionReservation: vi.fn(),
  toPackageLoadErrorMessage: () => '読み込みに失敗しました',
  subscribeToOpenPackage: vi.fn(),
  subscribeToOpenRecentPackage: vi.fn(),
  subscribeToPackageDirectoryOpen: vi.fn(),
}));
const info = vi.hoisted(() => vi.fn());
vi.mock('../../../../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ info }),
}));
const loaded = {
  configFilePath: '/match.stpkg/.metadata/config.json',
  packagePath: '/match.stpkg',
  team1Name: 'A',
  team2Name: 'B',
  missingSyncData: false,
  result: {
    videoList: ['/match.mp4'],
    syncData: undefined,
    timelinePath: '/match.stpkg/timeline.json',
    metaDataConfigFilePath: '/match.stpkg/.metadata/config.json',
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(gateway.pickPackagePath).mockImplementation(async (path) =>
    typeof path === 'string' ? path : '/match.stpkg',
  );
  vi.mocked(gateway.loadPackageDirectory).mockResolvedValue(loaded);
  vi.mocked(gateway.subscribeToOpenPackage).mockReturnValue(vi.fn());
  vi.mocked(gateway.subscribeToOpenRecentPackage).mockReturnValue(vi.fn());
  vi.mocked(gateway.subscribeToPackageDirectoryOpen).mockReturnValue(vi.fn());
});
afterEach(cleanup);
describe('useStartPackageOpen', () => {
  it('accepts one open request until loading finishes', async () => {
    let finish: ((value: typeof loaded) => void) | undefined;
    vi.mocked(gateway.loadPackageDirectory).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useStartPackageOpen(onLoaded));
    act(() => {
      void result.current.open();
      void result.current.open('/other.stpkg');
    });
    await waitFor(() =>
      expect(gateway.loadPackageDirectory).toHaveBeenCalledTimes(1),
    );
    expect(result.current.busy).toBe(true);
    await act(async () => {
      finish?.(loaded);
    });
    expect(onLoaded).toHaveBeenCalledOnce();
    expect(result.current.busy).toBe(false);
  });
  it('treats dialog cancellation as idle, without an error', async () => {
    vi.mocked(gateway.pickPackagePath).mockResolvedValue(null);
    const { result } = renderHook(() => useStartPackageOpen(vi.fn()));
    await act(async () => result.current.open());
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe('');
    expect(gateway.loadPackageDirectory).not.toHaveBeenCalled();
  });
  it('preserves failure details and retries the same path without changing the document', async () => {
    vi.mocked(gateway.loadPackageDirectory).mockRejectedValueOnce(
      new Error('ENOENT'),
    );
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useStartPackageOpen(onLoaded));
    await act(async () => result.current.open('/offline.stpkg'));
    expect(onLoaded).not.toHaveBeenCalled();
    expect(result.current.errorDetails).toContain('/offline.stpkg\nENOENT');
    expect(gateway.releasePackageSessionReservation).toHaveBeenCalledWith(
      '/offline.stpkg',
    );
    act(() => result.current.retry());
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(loaded.result));
    expect(gateway.loadPackageDirectory).toHaveBeenLastCalledWith(
      '/offline.stpkg',
    );
    expect(result.current.error).toBe('');
  });
  it('uses the same opener for native requests and releases all subscriptions', async () => {
    const onLoaded = vi.fn();
    const { unmount } = renderHook(() => useStartPackageOpen(onLoaded));
    await act(async () => {
      vi.mocked(gateway.subscribeToOpenRecentPackage).mock.calls[0][0](
        '/recent.stpkg',
      );
    });
    expect(gateway.loadPackageDirectory).toHaveBeenCalledWith('/recent.stpkg');
    unmount();
    for (const subscribe of [
      gateway.subscribeToOpenPackage,
      gateway.subscribeToOpenRecentPackage,
      gateway.subscribeToPackageDirectoryOpen,
    ]) {
      expect(vi.mocked(subscribe).mock.results[0].value).toHaveBeenCalledOnce();
    }
  });
  it('reports an invalid drop separately and lets the user choose a package to recover', async () => {
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useStartPackageOpen(onLoaded));
    act(() => result.current.reportInvalidDrop());
    expect(result.current.invalidDrop).toBe(true);
    expect(gateway.loadPackageDirectory).not.toHaveBeenCalled();
    act(() => result.current.retry());
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(loaded.result));
    expect(gateway.pickPackagePath).toHaveBeenLastCalledWith(undefined);
    expect(result.current.invalidDrop).toBe(false);
  });
});
