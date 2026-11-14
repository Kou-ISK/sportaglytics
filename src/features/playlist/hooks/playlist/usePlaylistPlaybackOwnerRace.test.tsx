// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { expect, it, vi } from 'vitest';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';
import { usePlaylistPlayback } from './usePlaylistPlayback';

const mocked = vi.hoisted(() => ({ wait: vi.fn(), confirm: vi.fn(), timelineOwner: null as object | null }));
vi.mock('../../../../shared/media/waitForVideoPresentation', () => ({
  waitForVideoPresentation: mocked.wait,
}));
vi.mock('../../media/usePlaylistMediaTimeline', () => ({
  usePlaylistMediaTimeline: () => ({
    resolve: () => undefined,
    seek: () => true,
    confirmSeek: mocked.confirm,
    timelineOwner: mocked.timelineOwner,
  }),
}));
vi.mock('./usePlaylistPlaybackActions', () => ({
  usePlaylistPlaybackActions: () => ({
    handleItemEnd: vi.fn(),
    triggerFreezeFrame: vi.fn(),
  }),
}));
vi.mock('./usePlaylistPlaybackEffects', () => ({
  usePlaylistPlaybackEffects: () => {},
}));

it('old source passive cleanup cannot abort a new source seek started in layout', async () => {
  const signals: AbortSignal[] = [];
  const finish: Array<(time: number) => void> = [];
  const setCurrentTime = vi.fn();
  mocked.wait.mockImplementation((_targets: unknown, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<number>((resolve) => finish.push(resolve));
  });
  const video = document.createElement('video');
  const makeParams = (source: string): UsePlaylistPlaybackParams =>
    ({
      currentItem: { id: source },
      currentVideoSource: source,
      currentVideoSource2: null,
      viewMode: 'angle1',
      videoRef: { current: video },
      videoRef2: { current: null },
      setCurrentTime,
    }) as unknown as UsePlaylistPlaybackParams;
  const hook = renderHook(
    ({ source }) => {
      const playback = usePlaylistPlayback(makeParams(source));
      useLayoutEffect(() => {
        void playback
          .seekReverse(source === 'one' ? 1 : 2, new AbortController().signal)
          .catch(() => {});
      }, [source]);
      return playback;
    },
    { initialProps: { source: 'one' } },
  );
  expect(signals).toHaveLength(1);
  hook.rerender({ source: 'two' });
  expect(signals).toHaveLength(2);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  await act(async () => {
    finish[0](1);
    await Promise.resolve();
  });
  expect(signals[1].aborted).toBe(false);
  expect(setCurrentTime).not.toHaveBeenCalled();
  await act(async () => {
    finish[1](2);
    await Promise.resolve();
  });
  expect(setCurrentTime).toHaveBeenCalledWith(2);
  expect(mocked.confirm).toHaveBeenCalledTimes(1);
  hook.unmount();
});


it('retains a wait across an unchanged timeline and aborts after timeline metadata changes', async () => {
  const signals: AbortSignal[] = [];
  let complete!: (value: number) => void;
  const setCurrentTime = vi.fn();
  mocked.timelineOwner = {};
  mocked.wait.mockImplementation((_targets: unknown, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<number>((resolve) => { complete = resolve; });
  });
  const video = document.createElement('video');
  const params = {
    currentItem: { id: 'item', startTime: 1, endTime: 20 },
    currentVideoSource: 'first.mp4', currentVideoSource2: 'second.mp4',
    viewMode: 'all', videoRef: { current: video },
    videoRef2: { current: document.createElement('video') }, setCurrentTime,
  } as unknown as UsePlaylistPlaybackParams;
  const hook = renderHook(() => usePlaylistPlayback(params));
  let pending!: Promise<number | null>;
  act(() => { pending = hook.result.current.seekReverse(5, new AbortController().signal); });
  hook.rerender();
  expect(signals[0].aborted).toBe(false);
  mocked.timelineOwner = {};
  hook.rerender();
  expect(signals[0].aborted).toBe(true);
  await act(async () => { complete(5); await expect(pending).rejects.toThrow('REVERSE_CANCELLED'); });
  expect(setCurrentTime).not.toHaveBeenCalled();
  hook.unmount();
  mocked.timelineOwner = null;
});

it('invalidates a pending request when the same item changes its range', async () => {
  const signals: AbortSignal[] = [];
  let complete!: (value: number) => void;
  const setCurrentTime = vi.fn();
  mocked.wait.mockImplementation((_targets: unknown, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<number>((resolve) => { complete = resolve; });
  });
  const video = document.createElement('video');
  const hook = renderHook(({ end }) => usePlaylistPlayback({
    currentItem: { id: 'item', startTime: 1, endTime: end },
    currentVideoSource: 'one.mp4', currentVideoSource2: null,
    viewMode: 'angle1', videoRef: { current: video },
    videoRef2: { current: null }, setCurrentTime,
  } as unknown as UsePlaylistPlaybackParams), { initialProps: { end: 20 } });
  let pending!: Promise<number | null>;
  act(() => { pending = hook.result.current.seekReverse(5, new AbortController().signal); });
  hook.rerender({ end: 21 });
  expect(signals[0].aborted).toBe(true);
  await act(async () => { complete(5); await expect(pending).rejects.toThrow('REVERSE_CANCELLED'); });
  expect(setCurrentTime).not.toHaveBeenCalled();
  hook.unmount();
});
