// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { UsePlaylistPlaybackParams } from '../hooks/playlist/usePlaylistPlayback.types';
import type { MediaTimeline } from '../../../shared/media/mediaTimeline';
import { usePlaylistMediaTimeline } from './usePlaylistMediaTimeline';
import { usePlaylistPlayback } from '../hooks/playlist/usePlaylistPlayback';

const source = '/review.stpkg/video.mp4';
const timeline: MediaTimeline = {
  offsetSeconds: 0,
  clips: [
    { id: 'source', source, timelineStartSeconds: 0, durationSeconds: 200 },
  ],
};
let pendingFrame: FrameRequestCallback | undefined;

const createMedia = () => {
  const video = document.createElement('video');
  let time = 0;
  let seeking = false;
  let paused = true;
  const seeks: number[] = [];
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 4 },
    seeking: { get: () => seeking },
    paused: { get: () => paused },
    currentTime: {
      get: () => time,
      set: (value: number) => {
        time = value;
        seeking = true;
        seeks.push(value);
      },
    },
  });
  vi.spyOn(video, 'load').mockImplementation(() => undefined);
  vi.spyOn(video, 'pause').mockImplementation(() => {
    paused = true;
  });
  vi.spyOn(video, 'play').mockImplementation(async () => {
    paused = false;
  });
  return {
    video,
    seeks,
    advance: (value: number): void => {
      time = value;
    },
    settle: (): void => {
      seeking = false;
      video.dispatchEvent(new Event('seeked'));
    },
  };
};

const setup = async (timelines: MediaTimeline[] = [timeline]) => {
  const media = createMedia();
  const secondary = timelines.length > 1 ? createMedia() : null;
  const resolve = vi
    .fn<() => Promise<MediaTimeline[]>>()
    .mockResolvedValue(timelines);
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { resolveMediaTimelines: resolve },
  });
  const item = {
    id: 'review',
    timelineItemId: null,
    actionName: 'Review',
    startTime: 60,
    endTime: 80,
    addedAt: 1,
    videoSource: source,
  };
  const params: UsePlaylistPlaybackParams = {
    items: [item],
    currentItem: item,
    currentIndex: 0,
    setCurrentIndex: vi.fn(),
    isPlaying: true,
    setIsPlaying: vi.fn(),
    isFrozen: false,
    setIsFrozen: vi.fn(),
    autoAdvance: true,
    loopPlaylist: false,
    viewMode: secondary ? 'dual' : 'angle1',
    currentVideoSource: source,
    currentVideoSource2: secondary ? '/review.stpkg/second.mp4' : null,
    videoRef: { current: media.video },
    videoRef2: { current: secondary?.video ?? null },
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    volume: 1,
    isMuted: true,
    setVolume: vi.fn(),
    containerRef: { current: null },
    isFullscreen: false,
    setIsFullscreen: vi.fn(),
    minFreezeDuration: 0.2,
    defaultFreezeDuration: 3,
    annotationTimeTolerance: 0.05,
    freezeRetriggerGuard: 0.5,
  };
  const callbacks = { current: { onTime: vi.fn(), onEnd: vi.fn() } };
  const hook = renderHook(
    (props: UsePlaylistPlaybackParams) =>
      usePlaylistMediaTimeline(props, callbacks),
    { initialProps: params },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  const tick = (timestamp: number): void => {
    const callback = pendingFrame;
    if (!callback) throw Error('Missing animation frame');
    act(() => callback(timestamp));
  };
  tick(0);
  media.settle();
  secondary?.settle();
  tick(16);
  media.seeks.length = 0;
  vi.mocked(media.video.pause).mockClear();
  callbacks.current.onTime.mockClear();
  return { ...hook, media, secondary, resolve, tick, callbacks, params };
};

beforeEach(() => {
  pendingFrame = undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('uses the decoded media clock after a delayed animation frame without rewinding', async () => {
  const { media, tick, callbacks } = await setup();
  media.advance(60.3);
  tick(316);
  expect(media.seeks).toEqual([]);
  expect(media.video.pause).not.toHaveBeenCalled();
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.3);
});

it('does not push a stalled media clock forward with animation elapsed time', async () => {
  const { media, tick, callbacks } = await setup();
  tick(116);
  tick(216);
  tick(316);
  expect(media.seeks).toEqual([]);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60);
});

it('keeps known media playing while focus revalidates unchanged timeline metadata', async () => {
  const { media, resolve, tick, callbacks } = await setup();
  let finish: ((value: MediaTimeline[]) => void) | undefined;
  resolve.mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  act(() => window.dispatchEvent(new Event('focus')));
  media.advance(60.05);
  tick(66);
  expect(media.video.pause).not.toHaveBeenCalled();
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.05);
  await act(async () => finish?.([timeline]));
});

it('waits for an explicit backward seek before using observations from the same source', async () => {
  const { media, tick, callbacks, result } = await setup();
  act(() => result.current.seek(62));
  media.advance(60.2); // The decoder has not delivered the requested position yet.
  tick(216);
  expect(callbacks.current.onTime).not.toHaveBeenCalled();
  media.advance(62);
  media.settle();
  tick(232);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(62);
  media.advance(62.4);
  tick(632);
  act(() => result.current.seek(61));
  media.settle();
  tick(648);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(61);
});

it('positions a new item on the same file before publishing its media clock', async () => {
  const { media, tick, callbacks, params, rerender } = await setup();
  media.advance(60.3);
  rerender({
    ...params,
    currentItem: {
      ...params.items[0],
      id: 'next',
      startTime: 90,
      endTime: 100,
    },
  });
  tick(316);
  expect(media.seeks).toEqual([90]);
  expect(callbacks.current.onTime).not.toHaveBeenCalled();
  media.settle();
  tick(332);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(90);
});

it('pauses and resumes from the confirmed position and finishes an item only once', async () => {
  const { media, tick, callbacks, params, rerender } = await setup();
  media.advance(60.3);
  rerender({ ...params, isPlaying: false });
  tick(332);
  expect(media.video.paused).toBe(true);
  expect(media.seeks).toEqual([]);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.3);
  rerender(params);
  tick(348);
  expect(media.video.paused).toBe(false);
  media.advance(80);
  tick(20016);
  tick(20032);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(80);
  expect(callbacks.current.onEnd).toHaveBeenCalledOnce();
});

it('honors a deliberate annotation freeze crossed by a delayed media observation', async () => {
  const { media, tick, callbacks, params, rerender } = await setup();
  rerender({
    ...params,
    currentAnnotation: {
      freezeDuration: 3,
      freezeAt: 60.5,
      objects: [
        {
          id: 'arrow',
          type: 'arrow',
          color: '#ffffff',
          strokeWidth: 2,
          startX: 0,
          startY: 0,
          endX: 10,
          endY: 10,
          timestamp: 60.5,
        },
      ],
    },
  });
  media.advance(60.6); // Below normal follower correction tolerance, but past the freeze.
  tick(2016);
  expect(media.seeks).toEqual([60.5]);
  expect(callbacks.current.onTime).not.toHaveBeenCalled();
  media.settle();
  tick(2032);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.5);
});

it('holds a buffering leader at its observed clock without seeking backwards', async () => {
  const { media, tick, callbacks } = await setup();
  media.advance(60.3);
  Object.defineProperty(media.video, 'readyState', {
    configurable: true,
    value: 1,
  });
  tick(316);
  expect(media.seeks).toEqual([]);
  expect(media.video.paused).toBe(true);
  expect(callbacks.current.onTime).not.toHaveBeenCalled();
  Object.defineProperty(media.video, 'readyState', {
    configurable: true,
    value: 4,
  });
  tick(332);
  expect(media.seeks).toEqual([]);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.3);
});

it('holds both angles while one buffers and resumes at the same package time', async () => {
  const { media, secondary, tick, callbacks } = await setup([
    timeline,
    { ...timeline, offsetSeconds: 2 },
  ]);
  if (!secondary) throw Error('Missing second angle');
  media.advance(60.3);
  secondary.advance(62.3);
  Object.defineProperty(secondary.video, 'readyState', {
    configurable: true,
    value: 1,
  });
  tick(316);
  expect(media.video.paused).toBe(true);
  expect(secondary.video.paused).toBe(true);
  expect(callbacks.current.onTime).not.toHaveBeenCalled();
  Object.defineProperty(secondary.video, 'readyState', {
    configurable: true,
    value: 4,
  });
  tick(332);
  expect(media.video.paused).toBe(false);
  expect(secondary.video.paused).toBe(false);
  expect(media.seeks).toEqual([]);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.3);
});

it('follows the second angle through a primary gap and waits for the next source', async () => {
  const nextSource: MediaTimeline = {
    offsetSeconds: 0,
    clips: [
      {
        id: 'later',
        source: '/review.stpkg/later.mp4',
        timelineStartSeconds: 61,
        durationSeconds: 10,
      },
    ],
  };
  const { media, secondary, tick, callbacks } = await setup([
    nextSource,
    timeline,
  ]);
  if (!secondary) throw Error('Missing second angle');
  secondary.advance(60.3);
  tick(316);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(60.3);
  expect(media.video.style.visibility).toBe('hidden');
  secondary.advance(61.1);
  tick(1116);
  expect(media.video.src).toBe('file:///review.stpkg/later.mp4');
  expect(media.seeks[0]).toBeCloseTo(0.1);
  expect(secondary.video.paused).toBe(true);
  media.settle();
  tick(1132);
  expect(callbacks.current.onTime).toHaveBeenLastCalledWith(61.1);
  expect(media.video.paused).toBe(false);
  expect(secondary.video.paused).toBe(false);
});

it('stops on metadata refresh failure instead of continuing with stale sources', async () => {
  const { resolve, tick, media, result, params } = await setup();
  resolve.mockRejectedValueOnce(Error('Disconnected'));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.error).not.toBe(''));
  tick(32);
  expect(media.video.paused).toBe(true);
  expect(params.setIsPlaying).toHaveBeenCalledWith(false);
});

it('reports an unexpectedly early source end without restarting at zero', async () => {
  const { media, tick, result, params } = await setup();
  media.advance(70);
  Object.defineProperty(media.video, 'ended', { value: true });
  vi.mocked(media.video.play).mockClear();
  tick(10016);
  expect(media.video.play).not.toHaveBeenCalled();
  expect(params.setIsPlaying).toHaveBeenCalledWith(false);
  expect(result.current.error).toContain('映像が保存された区間より早く終了');
});

it('resumes after the real annotation freeze without repeating the same stop', async () => {
  const { media, tick, params, unmount } = await setup();
  unmount();
  const annotation = {
    freezeDuration: 0.2,
    freezeAt: 60.5,
    objects: [
      {
        id: 'arrow',
        type: 'arrow' as const,
        color: '#ffffff',
        strokeWidth: 2,
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 10,
        timestamp: 60.5,
      },
    ],
  };
  const integrated = renderHook(() => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isFrozen, setIsFrozen] = useState(false);
    const playback = usePlaylistPlayback({
      ...params,
      isPlaying,
      setIsPlaying,
      isFrozen,
      setIsFrozen,
      currentAnnotation: annotation,
    });
    return { ...playback, isPlaying, isFrozen };
  });
  await waitFor(() =>
    expect(integrated.result.current.mediaTimeline.loading).toBe(false),
  );
  tick(0);
  media.settle();
  tick(16);
  media.seeks.length = 0;
  vi.useFakeTimers();
  try {
    media.advance(60.6);
    tick(616);
    expect(media.seeks).toEqual([60.5]);
    media.settle();
    tick(632);
    expect(integrated.result.current.isFrozen).toBe(true);
    expect(media.video.paused).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    tick(832);
    expect(integrated.result.current.isPlaying).toBe(true);
    expect(integrated.result.current.isFrozen).toBe(false);
    media.advance(60.8);
    tick(1132);
    expect(media.seeks).toEqual([60.5]);
    expect(integrated.result.current.isFrozen).toBe(false);
  } finally {
    vi.useRealTimers();
    integrated.unmount();
  }
});
