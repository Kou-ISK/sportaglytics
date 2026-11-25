// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';
import { useVideoTimeController } from './useVideoTimeController';
import type { VideoSeekMode } from '../../../../types/video/seek';

const harness = vi.hoisted(() => ({
  decodes: [] as {
    targets: readonly VideoPresentationTarget[];
    signal: AbortSignal;
    resolve: (time: number) => void;
    reject: (err: Error) => void;
  }[],
}));
vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: (id: string) => ({ el: () => document.getElementById(id) }),
  setVideoJsPlayerCurrentTime: vi.fn(),
}));
vi.mock('../../../../shared/media/waitForVideoPresentation', () => ({
  waitForVideoPresentation: (
    targets: readonly VideoPresentationTarget[],
    signal: AbortSignal,
    issue: () => void,
  ) => {
    issue();
    return new Promise<number>((resolve, reject) => {
      harness.decodes.push({ targets, signal, resolve, reject });
    });
  },
}));
const setup = (cold = false) => {
  const videoList = ['one.mp4', 'two.mp4'];
  const syncData = { syncOffset: cold ? 0 : 2, isAnalyzed: true };
  const mediaAngles = videoList.map((source, index) => ({
    id: source,
    name: source,
    sourceKind: 'local' as const,
    clips: [
      {
        id: source,
        source,
        sourceKind: 'local' as const,
        timelineStartSeconds: index,
        durationSeconds: 40,
        gapBeforeSeconds: index,
      },
    ],
  }));
  const onScrubFailure = vi.fn();
  document.body.innerHTML =
    '<div id="video_0"><video></video></div><div id="video_1"><video></video></div>';
  if (cold) {
    const primary = document.querySelector('video')!;
    Object.defineProperties(primary, {
      currentSrc: { value: `file:///${videoList[0]}` },
      readyState: { value: 2 },
    });
  }
  const initialProps = {
    dualView: true,
    videoList,
    syncData,
    mediaAngles,
    syncMode: 'auto' as const,
    onScrubFailure,
  };
  const hook = renderHook(useVideoTimeController, { initialProps });
  const seek = (
    time: number,
    mode: VideoSeekMode,
    input = 'visual-timeline-seek',
  ): void => {
    act(() =>
      hook.result.current.handleCurrentTime(new Event(input), time, mode),
    );
  };
  return { hook, seek, onScrubFailure, initialProps };
};
afterEach(() => {
  harness.decodes.length = 0;
  document.body.replaceChildren();
});

it('chases the newest target through both angle offsets, then anchors at release', async () => {
  const { hook, seek } = setup();
  seek(10, 'preview');
  seek(12, 'preview');
  seek(7, 'preview');
  expect(harness.decodes.map((x) => x.targets.map((t) => t.time))).toEqual([
    [10, 11],
  ]);
  act(() => hook.result.current.setCurrentTime(12));
  expect(hook.result.current.currentTime).toBe(0);
  await act(async () => harness.decodes[0].resolve(9.99));
  expect(hook.result.current.currentTime).toBe(9.99);
  expect(harness.decodes[1].targets.map((t) => t.time)).toEqual([7, 8]);
  seek(8.01, 'scrub');
  await act(async () => harness.decodes[1].resolve(6.99));
  expect(hook.result.current.currentTime).toBe(9.99);
  expect(hook.result.current.scrubbing).toBe(true);
  await act(async () => harness.decodes[2].resolve(8.0));
  expect(hook.result.current.currentTime).toBe(8.01);
  expect(hook.result.current.scrubbing).toBe(false);
  hook.unmount();
});

it('ignores the old window release even after the newer gesture has finished', async () => {
  const { hook, seek } = setup();
  seek(10, 'preview');
  seek(12, 'preview', 'timeline-window-seek');
  expect(harness.decodes[0].signal.aborted).toBe(true);
  act(() => window.dispatchEvent(new Event('timeline-window-preview-end')));
  await act(async () => harness.decodes[1].resolve(12));
  await act(async () => harness.decodes[2].resolve(12));
  seek(10, 'scrub');
  await act(async () => harness.decodes[0].resolve(10));
  expect(harness.decodes).toHaveLength(3);
  expect(hook.result.current.currentTime).toBe(12);
  hook.unmount();
});

it('reports a failed final presentation and keeps the last confirmed time', async () => {
  const { hook, seek, onScrubFailure } = setup();
  seek(10, 'preview');
  await act(async () => harness.decodes[0].resolve(9.99));
  seek(12, 'scrub');
  await act(async () => harness.decodes[1].reject(Error('image unavailable')));
  expect(onScrubFailure).toHaveBeenCalledOnce();
  act(() => hook.result.current.setCurrentTime(12));
  expect(hook.result.current.scrubbing).toBe(false);
  expect(hook.result.current.currentTime).toBe(9.99);
  hook.unmount();
});

it('keeps the cold angle masked and blocks coding-clock writes until the release pair is proved', async () => {
  const { hook, seek } = setup(true);
  seek(8, 'preview');
  seek(10, 'scrub');
  await act(async () => harness.decodes[0].resolve(7.99));
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  expect(hook.result.current.playbackTime).toBe(10);
  expect(harness.decodes[1].targets.map((target) => target.time)).toEqual([
    10, 9,
  ]);
  act(() => hook.result.current.setCurrentTime(10));
  expect(hook.result.current.currentTime).toBe(0);
  await act(async () => harness.decodes[1].resolve(9.99));
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  expect(hook.result.current.currentTime).toBe(10);
  expect(hook.result.current.playbackTime).toBe(10);
  hook.unmount();
});

it('restores the old gap after failure without promoting the cold seek', async () => {
  const { hook, seek, onScrubFailure } = setup(true);
  seek(8, 'preview');
  seek(10, 'scrub');
  await act(async () => harness.decodes[0].resolve(7.99));
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  await act(async () => harness.decodes[1].reject(Error('image unavailable')));
  expect(onScrubFailure).toHaveBeenCalledOnce();
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  expect(hook.result.current.playbackTime).toBe(0);
  expect(hook.result.current.currentTime).toBe(0);
  hook.unmount();
});

it('cancels the masked pair on source change and ignores its late proof', async () => {
  const { hook, seek, initialProps } = setup(true);
  seek(10, 'preview');
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  hook.rerender({ ...initialProps, videoList: ['new.mp4'], mediaAngles: [] });
  expect(harness.decodes[0].signal.aborted).toBe(true);
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  expect(hook.result.current.playbackTime).toBe(0);
  await act(async () => harness.decodes[0].resolve(10));
  expect(hook.result.current.currentTime).toBe(0);
  hook.unmount();
});

it('masks on mid-gesture gap exit and discards an in-flight A-only proof', async () => {
  const { hook, seek } = setup(true);
  seek(0.5, 'preview');
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  expect(harness.decodes[0].targets.map((target) => target.time)).toEqual([
    0.5,
  ]);
  seek(10, 'preview');
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  await act(async () => harness.decodes[0].resolve(0.49));
  expect(hook.result.current.currentTime).toBe(0);
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  expect(harness.decodes[1].targets.map((target) => target.time)).toEqual([
    10, 9,
  ]);
  await act(async () => harness.decodes[1].resolve(9.99));
  expect(hook.result.current.currentTime).toBe(9.99);
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  hook.unmount();
});

it('cancels the cold pair on a switch to solitary view without masking the new view', async () => {
  const { hook, seek, initialProps } = setup(true);
  seek(10, 'preview');
  expect(hook.result.current.maskedScrubAngles).toEqual([1]);
  hook.rerender({ ...initialProps, dualView: false });
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  expect(harness.decodes[0].signal.aborted).toBe(true);
  await act(async () => harness.decodes[0].resolve(10));
  expect(hook.result.current.currentTime).toBe(0);
  seek(12, 'preview');
  expect(hook.result.current.maskedScrubAngles).toEqual([]);
  await act(async () => harness.decodes[1].resolve(11.99));
  expect(hook.result.current.currentTime).toBe(11.99);
  hook.unmount();
});
