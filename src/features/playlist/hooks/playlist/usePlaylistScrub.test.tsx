// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePlaylistPlayback } from './usePlaylistPlayback';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';

const harness = vi.hoisted(() => ({
  wait: vi.fn(),
  resolve: vi.fn(),
  clock: { current: { onTime: (_: number) => {} } },
}));
vi.mock('../../../../shared/media/waitForVideoPresentation', () => ({
  waitForVideoPresentation: harness.wait,
}));
vi.mock('../../media/usePlaylistMediaTimeline', () => ({
  usePlaylistMediaTimeline: (_: unknown, clock: typeof harness.clock) => {
    harness.clock = clock;
    return {
      resolve: harness.resolve,
      seek: () => true,
      confirmSeek: () => {},
      timelineOwner: null,
    };
  },
}));
vi.mock('./usePlaylistPlaybackEffects', () => ({
  usePlaylistPlaybackEffects: () => {},
}));
const noop = (): void => {};
const setup = () => {
  const setCurrentTime = vi.fn();
  const a = document.createElement('video'),
    b = document.createElement('video');
  const hook = renderHook(
    ({ id }) =>
      usePlaylistPlayback({
        currentItem: {
          id,
          startTime: 0,
          endTime: 20,
          actionName: 'action',
          timelineItemId: null,
          addedAt: 0,
        },
        items: [],
        currentIndex: 0,
        setCurrentIndex: noop,
        setDuration: noop,
        autoAdvance: false,
        loopPlaylist: false,
        volume: 1,
        isMuted: false,
        setVolume: noop,
        containerRef: { current: null },
        isFullscreen: false,
        setIsFullscreen: noop,
        minFreezeDuration: 0.1,
        defaultFreezeDuration: 1,
        annotationTimeTolerance: 0.05,
        freezeRetriggerGuard: 0.04,
        isPlaying: false,
        setIsPlaying: noop,
        isFrozen: false,
        setIsFrozen: noop,
        currentVideoSource: 'a.mp4',
        currentVideoSource2: 'b.mp4',
        viewMode: 'dual',
        videoRef: { current: a },
        videoRef2: { current: b },
        setCurrentTime,
      }),
    { initialProps: { id: 'first' } },
  );
  return { hook, setCurrentTime, a, b };
};
beforeEach(() => {
  harness.wait.mockReset();
  harness.resolve
    .mockReset()
    .mockImplementation((time: number, secondary: boolean) => ({
      clip: { source: secondary ? 'b.mp4' : 'a.mp4' },
      sourceTime: time + (secondary ? 0.4 : 0),
      sourceTimeOffset: secondary ? 0.4 : 0,
    }));
});
it('waits for both angle targets then commits the release, discarding intermediate pointer positions', async () => {
  let complete: (time: number) => void = noop;
  harness.wait.mockImplementation(
    () =>
      new Promise<number>((resolve) => {
        complete = resolve;
      }),
  );
  const { hook, setCurrentTime, a, b } = setup();
  act(() => {
    hook.result.current.handleScrub(7, false);
    hook.result.current.handleScrub(2, false);
    hook.result.current.handleScrub(20, true);
  });
  expect(harness.wait).toHaveBeenCalledTimes(1);
  const targets: VideoPresentationTarget[] = harness.wait.mock.calls[0][0];
  expect(targets.map((t) => [t.video, t.time])).toEqual([
    [a, 7],
    [b, 7.4],
  ]);
  await act(async () => complete(6.98));
  expect(setCurrentTime).not.toHaveBeenCalled();
  expect(harness.resolve).toHaveBeenCalledWith(20, true, true);
  await act(async () => complete(19.98));
  expect(setCurrentTime).toHaveBeenCalledExactlyOnceWith(20);
  expect(hook.result.current.scrubbing).toBe(false);
  hook.unmount();
});
it('rejects an old release and ignores an old in-flight presentation after an item switch', async () => {
  let complete: (time: number) => void = noop;
  harness.wait.mockImplementation(
    () =>
      new Promise<number>((resolve) => {
        complete = resolve;
      }),
  );
  const { hook, setCurrentTime } = setup();
  const old = hook.result.current.handleScrub;
  act(() => old(8, false));
  hook.rerender({ id: 'second' });
  act(() => {
    old(3, true);
    hook.result.current.handleScrub(3, true);
  });
  await act(async () => complete(8));
  expect(harness.wait).toHaveBeenCalledTimes(1);
  expect(setCurrentTime).not.toHaveBeenCalled();
  hook.unmount();
});
it('holds the confirmed clock on a failed final image until an explicit retry proves the frame', async () => {
  harness.wait
    .mockResolvedValueOnce(5)
    .mockRejectedValueOnce(new Error('decode'));
  const { hook, setCurrentTime } = setup();
  await act(async () => hook.result.current.handleScrub(5, false));
  await act(async () => hook.result.current.handleScrub(9, true));
  act(() => harness.clock.current.onTime(9));
  expect(setCurrentTime.mock.calls).toEqual([[5]]);
  expect(hook.result.current.mediaTimeline.error).toBeTruthy();
  harness.wait.mockResolvedValue(8.98);
  await act(async () => hook.result.current.mediaTimeline.retry());
  expect(setCurrentTime.mock.calls).toEqual([[5], [9]]);
  hook.unmount();
});
