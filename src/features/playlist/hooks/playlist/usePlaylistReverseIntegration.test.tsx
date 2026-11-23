// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlaylistWindowDataRuntime } from './usePlaylistWindowDataRuntime';
import { usePlaylistWindowInteractionRuntime } from './usePlaylistWindowInteractionRuntime';

const mocks = vi.hoisted(() => ({
  seek: vi.fn(),
  normal: vi.fn(),
  error: vi.fn(),
  handlers: {} as Record<string, () => void>,
  up: {} as Record<string, () => void>,
}));
vi.mock('../../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ error: mocks.error }),
}));
vi.mock('../../../../hooks/useGlobalHotkeys', () => ({
  useGlobalHotkeys: (
    _keys: unknown,
    handlers: typeof mocks.handlers,
    up: typeof mocks.up,
  ) => {
    mocks.handlers = handlers;
    mocks.up = up;
  },
}));
vi.mock('./usePlaylistDrawingTarget', () => ({
  usePlaylistDrawingTarget: () => {},
}));
vi.mock('./usePlaylistVideoSizing', () => ({
  usePlaylistVideoSizing: () => {},
}));
vi.mock('./usePlaylistControlsVisibility', () => ({
  usePlaylistControlsVisibility: () => {},
}));
vi.mock('./usePlaylistSaveRequest', () => ({
  usePlaylistSaveRequest: () => {},
}));
vi.mock('./usePlaylistDrawingModeToggle', () => ({
  usePlaylistDrawingModeToggle: () => vi.fn(),
}));
vi.mock('./usePlaylistHotkeys', () => ({ usePlaylistHotkeys: () => [] }));
vi.mock('./usePlaylistPlayback', () => ({
  usePlaylistPlayback: () => ({
    seekReverse: mocks.seek,
    handleSeek: mocks.normal,
  }),
}));

const buildRuntime = (source: string): PlaylistWindowDataRuntime =>
  ({
    core: {
      loadQueue: { documentGeneration: 0 },
      currentTime: 10,
      currentIndex: 0,
      viewMode: 'angle1',
      workspaceMode: 'normal',
      videoRef: { current: null },
      videoRef2: { current: null },
      setIsPlaying: vi.fn(),
    },
    history: { items: [] },
    selection: {},
    exportState: {},
    annotations: {},
    currentItemState: {
      currentItem: { id: 'item', startTime: 0 },
      currentVideoSource: source,
    },
    saveFlow: {},
  }) as unknown as PlaylistWindowDataRuntime;

const setup = () => {
  mocks.seek.mockReset();
  mocks.normal.mockReset();
  mocks.error.mockReset();
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++next, cb);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const tick = (time: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](time);
  };
  let resolve = (_value: number): void => {};
  const resolvers: Array<(value: number) => void> = [];
  mocks.seek.mockImplementation(
    () =>
      new Promise<number>((done) => {
        resolve = done;
        resolvers.push(done);
      }),
  );
  const hook = renderHook(
    ({ source }) => usePlaylistWindowInteractionRuntime(buildRuntime(source)),
    { initialProps: { source: 'first' } },
  );
  const press = () => mocks.handlers['reverse-playback-2x']();
  const release = () => mocks.up['reverse-playback-2x']();
  const initiate = () =>
    act(() => {
      press();
      tick(1000);
      tick(1050);
      tick(1100);
      release();
    });
  return {
    hook,
    initiate,
    tick,
    resolvers,
    press,
    release,
    finish: async () => {
      await act(async () => {
        resolve(9.9);
        await Promise.resolve();
        await Promise.resolve();
      });
    },
  };
};
afterEach(() => {
  vi.unstubAllGlobals();
});

it('does not send the old pending seek when playlist reverse is released', async () => {
  const h = setup();
  h.initiate();
  await h.finish();
  expect(mocks.seek).toHaveBeenCalledTimes(1);
  h.hook.unmount();
});
it('does not send the old pending seek after playlist release and preserves a new short press', async () => {
  const h = setup();
  h.initiate();
  expect(mocks.seek).toHaveBeenCalledTimes(1);
  act(() => {
    h.press();
    h.release();
  });
  await h.finish();
  expect(mocks.seek).toHaveBeenCalledTimes(2);
  expect(mocks.seek.mock.calls[1][0]).toBeLessThan(9.9);
  h.hook.unmount();
});
it('normal playlist seek invalidates a waiting re-press', async () => {
  const h = setup();
  h.initiate();
  act(() => {
    h.press();
    h.release();
  });
  act(() => h.hook.result.current.playback.handleSeek(new Event('seek'), 20));
  await h.finish();
  expect(mocks.seek).toHaveBeenCalledTimes(1);
  expect(mocks.normal).toHaveBeenCalledOnce();
  expect(mocks.error).not.toHaveBeenCalled();
  h.hook.unmount();
});
it('playlist media change invalidates a waiting re-press', async () => {
  const h = setup();
  h.initiate();
  act(() => {
    h.press();
    h.release();
  });
  h.hook.rerender({ source: 'second' });
  await h.finish();
  expect(mocks.seek).toHaveBeenCalledTimes(1);
  expect(mocks.error).not.toHaveBeenCalled();
  h.hook.unmount();
});

it('old keyup and seek completion after media change cannot cancel a new short press', async () => {
  const h = setup();
  act(() => {
    h.press();
    h.tick(1000);
    h.tick(1050);
  });
  const oldSignal = mocks.seek.mock.calls[0][1] as AbortSignal;
  h.hook.rerender({ source: 'second' });
  expect(oldSignal.aborted).toBe(true);
  act(() => h.release());
  act(() => {
    h.press();
    h.tick(2000);
    h.tick(2050);
  });
  expect(mocks.seek).toHaveBeenCalledTimes(2);
  const newSignal = mocks.seek.mock.calls[1][1] as AbortSignal;
  await act(async () => {
    h.resolvers[0](9.9);
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  expect(newSignal.aborted).toBe(false);
  act(() => h.release());
  await act(async () => {
    h.resolvers[1](9.8);
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  expect(mocks.seek).toHaveBeenCalledTimes(2);
  expect(mocks.error).not.toHaveBeenCalled();
  h.hook.unmount();
});

it('unmount invalidates an active playlist seek and ignores its old completion', async () => {
  const h = setup();
  act(() => {
    h.press();
    h.tick(1000);
    h.tick(1050);
  });
  const signal = mocks.seek.mock.calls[0][1] as AbortSignal;
  h.hook.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    h.resolvers[0](9.9);
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  expect(mocks.seek).toHaveBeenCalledTimes(1);
  expect(mocks.error).not.toHaveBeenCalled();
});
