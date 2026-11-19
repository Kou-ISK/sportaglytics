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
const setup = () => {
  const videoList = ['one.mp4', 'two.mp4'];
  const syncData = { syncOffset: 2, isAnalyzed: true };
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
  const hook = renderHook(useVideoTimeController, {
    initialProps: {
      videoList,
      syncData,
      mediaAngles,
      syncMode: 'auto' as const,
      onScrubFailure,
    },
  });
  const seek = (
    time: number,
    mode: VideoSeekMode,
    input = 'visual-timeline-seek',
  ): void => {
    act(() =>
      hook.result.current.handleCurrentTime(new Event(input), time, mode),
    );
  };
  return { hook, seek, onScrubFailure };
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
