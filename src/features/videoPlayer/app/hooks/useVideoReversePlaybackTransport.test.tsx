// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useVideoReversePlayback } from './useVideoReversePlayback';

const mocks = vi.hoisted(() => ({
  native: null as null | {
    snapshot: () => { phase: string };
    isFallingBack: boolean;
    supportsReverse: () => boolean;
    controls: () => void;
    seek: (time: number) => void;
    commandRevision: number;
  },
  wait: vi.fn(),
}));
vi.mock('../../shared/nativePlayback/nativePlaybackRegistry', () => ({
  getNativePlayback: () => mocks.native,
  subscribeNativePlayback: () => () => {},
}));
vi.mock('../../shared/nativePlayback/waitForNativePresentation', () => ({
  waitForNativePresentation: mocks.wait,
}));

afterEach(() => {
  mocks.native = null;
  mocks.wait.mockReset();
  vi.unstubAllGlobals();
});

const setup = (initialPhase: string, initialPending = true) => {
  let phase = initialPhase;
  let finish = (): void => {};
  const nativeSeek = vi.fn();
  const native = {
    snapshot: () => ({ phase }),
    isFallingBack: false,
    subscribe: () => () => {},
    supportsReverse: () => false,
    controls: vi.fn(),
    seek: nativeSeek,
    commandRevision: 1,
  };
  mocks.native = native;
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (time: number): void => {
    const item = frames.entries().next().value;
    if (!item) throw Error('missing frame');
    frames.delete(item[0]);
    item[1](time);
  };
  const htmlSeek = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finish = () => resolve(9.9);
      }),
  );
  mocks.wait.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const onError = vi.fn();
  const videos = ['synthetic'];
  const hook = renderHook(() =>
    useVideoReversePlayback({
      videoList: videos,
      currentTime: 10,
      onPause: vi.fn(),
      onSeek: htmlSeek,
      onError,
    }),
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(0);
    tick(50);
    if (initialPending) tick(100);
  });
  return {
    hook,
    htmlSeek,
    native,
    tick,
    onError,
    nativeSeek,
    setPhase: (next: string) => {
      phase = next;
    },
    finish: async () => {
      await act(async () => {
        finish();
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });
    },
  };
};

it('discards an HTML pending seek after phase changes to native', async () => {
  const f = setup('original');
  expect(f.htmlSeek).toHaveBeenCalledTimes(1);
  f.setPhase('active');
  act(() => f.hook.result.current.finishReversePlayback());
  await f.finish();
  expect(f.nativeSeek).not.toHaveBeenCalled();
  expect(f.htmlSeek).toHaveBeenCalledTimes(1);
  f.hook.unmount();
});
it('does not route a native pending seek to HTML when the phase changes', async () => {
  const f = setup('active');
  expect(f.nativeSeek).toHaveBeenCalledTimes(1);
  f.setPhase('original');
  act(() => f.hook.result.current.finishReversePlayback());
  await f.finish();
  expect(f.htmlSeek).not.toHaveBeenCalled();
  f.hook.unmount();
});

it('does not redirect a settled held HTML gesture after speed change and native activation', async () => {
  const f = setup('original', false);
  await f.finish();
  f.setPhase('active');
  act(() => {
    f.hook.result.current.startReversePlayback(4);
    f.tick(100);
  });
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
  expect(f.nativeSeek).not.toHaveBeenCalled();
  expect(f.onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'REVERSE_TRANSPORT_CHANGED' }),
  );
  f.hook.unmount();
});

it('does not send a held native controller A gesture to replacement controller B', async () => {
  const f = setup('active', false);
  await f.finish();
  const bSeek = vi.fn();
  mocks.native = { ...f.native, seek: bSeek };
  act(() => {
    f.hook.result.current.startReversePlayback(4);
    f.tick(100);
  });
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
  expect(bSeek).not.toHaveBeenCalled();
  expect(f.onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'REVERSE_TRANSPORT_CHANGED' }),
  );
  f.hook.unmount();
});

it('does not redirect a settled held native gesture after speed change and HTML restoration', async () => {
  const f = setup('active', false);
  await f.finish();
  f.setPhase('original');
  act(() => {
    f.hook.result.current.startReversePlayback(4);
    f.tick(100);
  });
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
  expect(f.htmlSeek).not.toHaveBeenCalled();
  expect(f.onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'REVERSE_TRANSPORT_CHANGED' }),
  );
  f.hook.unmount();
});

it('invalidates an in-flight native presentation when its controller is replaced before release', async () => {
  const f = setup('active', false);
  const signal = mocks.wait.mock.calls[0][2] as AbortSignal;
  expect(signal.aborted).toBe(false);
  mocks.native = { ...f.native, seek: vi.fn() };
  act(() => f.hook.result.current.finishReversePlayback());
  expect(signal.aborted).toBe(true);
  await f.finish();
  f.hook.unmount();
});
