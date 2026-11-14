// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import { bindNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { useVideoReversePlayback } from './useVideoReversePlayback';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const owner = { generation: 'integration', sourceKey: 'a'.repeat(64) };
const createController = () => {
  const api = {
    open: vi.fn(async () => {}),
    onSnapshot: vi.fn(() => () => {}),
    apply: vi.fn(async () => {}),
    observe: vi.fn(async () => ({ intent: null, observation: null, lastConfirmedTime: 10, error: null, closing: false, closed: false })),
    close: vi.fn(async () => ({ generation: owner.generation, nativeDrained: true, processStarted: true, processExited: true, pipesClosed: true, stopped: null })),
    reportFailure: vi.fn(async () => {}),
  };
  const original = { pause: vi.fn(), restore: vi.fn(async () => {}), release: vi.fn(), restored: vi.fn() };
  const controller = new NativePlaybackController(api as never, owner, 'file:///synthetic.mp4', 10, { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true }, original);
  return controller;
};
const setup = () => {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (time: number) => { const item = frames.entries().next().value; if (!item) throw Error('missing frame'); frames.delete(item[0]); item[1](time); };
  let signal: AbortSignal | undefined;
  const onSeek = vi.fn((_time: number, s: AbortSignal) => { signal = s; return new Promise<number>(() => {}); });
  const videoList = ['synthetic'];
  const hook = renderHook(() => useVideoReversePlayback({ videoList, currentTime: 10, onPause: vi.fn(), onSeek }));
  act(() => { hook.result.current.startReversePlayback(2); tick(0); tick(50); hook.result.current.finishReversePlayback(); });
  expect(signal).toBeDefined(); expect(signal?.aborted).toBe(false);
  return { hook, signal: signal! };
};
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('cancels released HTML seek when a real registered controller becomes active', async () => {
  const f = setup(); const controller = createController(); let unbind = () => {};
  act(() => { unbind = bindNativePlayback(controller); });
  expect(f.signal.aborted).toBe(false); // opening still routes to HTML
  await act(async () => { await flush(); });
  expect(controller.snapshot().phase).toBe('active');
  expect(f.signal.aborted).toBe(true);
  f.hook.unmount();
  await act(async () => { await controller.returnToOriginal(); await flush(); });
  unbind();
});

it('does not cancel a released HTML seek on a harmless notification and detaches on unmount', async () => {
  const controller = createController(); await act(async () => { await flush(); });
  await act(async () => { await controller.returnToOriginal(); await flush(); });
  const subscribe = controller.subscribe;
  const detached = vi.fn();
  vi.spyOn(controller, 'subscribe').mockImplementation((listener) => {
    const unsubscribe = subscribe(listener);
    return () => { detached(); unsubscribe(); };
  });
  const unbind = bindNativePlayback(controller); const f = setup();
  // A real controller update not changing the chosen HTML transport.
  act(() => { (controller as unknown as { update: (v: object) => void }).update({ time: 10 }); });
  expect(f.signal.aborted).toBe(false);
  f.hook.unmount(); expect(f.signal.aborted).toBe(true); expect(detached).toHaveBeenCalled();
  expect(() => unbind()).not.toThrow();
});

it('cancels a released native seek when the real controller enters failed phase', async () => {
  const controller = createController(); await act(async () => { await flush(); });
  const unbind = bindNativePlayback(controller);
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (time: number) => { const item = frames.entries().next().value; if (!item) throw Error('missing frame'); frames.delete(item[0]); item[1](time); };
  const onSeek = vi.fn(); const videoList = ['synthetic'];
  const hook = renderHook(() => useVideoReversePlayback({ videoList, currentTime: 10, onPause: vi.fn(), onSeek }));
  act(() => { hook.result.current.startReversePlayback(2); tick(0); tick(50); hook.result.current.finishReversePlayback(); });
  expect(onSeek).not.toHaveBeenCalled(); expect(hook.result.current.isReverseSettled()).toBe(false);
  act(() => controller.fail('synthetic-failure'));
  expect(hook.result.current.isReverseSettled()).toBe(true);
  hook.unmount();
  await act(async () => { await controller.returnToOriginal(); await flush(); });
  unbind();
});
