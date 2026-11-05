// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoTimeController } from './useVideoTimeController';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: vi.fn(),
  setVideoJsPlayerCurrentTime: vi.fn(),
}));

it('ignores an unmounted gesture callback belonging to the previous source', () => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const events = vi.spyOn(window, 'dispatchEvent');
  const params: Parameters<typeof useVideoTimeController>[0] = {
    videoList: ['first.mp4'],
    syncData: undefined,
    syncMode: 'auto',
    mediaAngles: [],
  };
  const hook = renderHook(useVideoTimeController, { initialProps: params });
  const previous = hook.result.current.handleCurrentTime;
  hook.rerender({ ...params, videoList: ['second.mp4'] });
  act(() => previous(new Event('seek'), 30, 'scrub'));
  expect(events).not.toHaveBeenCalled();
  act(() => hook.result.current.handleCurrentTime(new Event('seek'), 2));
  expect(hook.result.current.currentTime).toBe(2);
  hook.unmount();
  events.mockRestore();
  vi.unstubAllGlobals();
});

it('resets the running package clock when a seek is clamped to the beginning', () => {
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    frame = next;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const params = {
    videoList: [],
    syncData: undefined,
    syncMode: 'auto' as const,
    mediaAngles: [
      {
        id: 'one',
        name: 'One',
        sourceKind: 'local' as const,
        clips: [
          {
            id: 'clip',
            sourceKind: 'local' as const,
            source: 'media/clip.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 60,
            gapBeforeSeconds: 0,
          },
        ],
      },
    ],
    isVideoPlaying: true,
    videoPlayBackRate: 1,
    setIsVideoPlaying: vi.fn(),
    setMaxSec: vi.fn(),
  };
  const hook = renderHook(() => {
    const controller = useVideoTimeController(params);
    usePackagePlaybackClock({ ...params, ...controller });
    return controller;
  });
  try {
    act(() => {
      frame(0);
      frame(1000);
    });
    expect(hook.result.current.currentTime).toBe(1);
    act(() => hook.result.current.handleCurrentTime(new Event('seek'), -1));
    expect(hook.result.current.currentTime).toBe(0);
    act(() => frame(2000));
    expect(hook.result.current.currentTime).toBe(1);
  } finally {
    hook.unmount();
    warning.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('ends the reverse seek after paint so ordinary angle synchronization resumes', async () => {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const events = vi.spyOn(window, 'dispatchEvent');
  // A resolved empty interval exercises the paint fence without inventing media.
  const params: Parameters<typeof useVideoTimeController>[0] = {
    videoList: [],
    syncData: undefined,
    syncMode: 'auto',
    mediaAngles: [],
  };
  const hook = renderHook(() => useVideoTimeController(params));
  try {
    let work!: Promise<void>;
    act(() => {
      work = hook.result.current.seekReverse(3, new AbortController().signal);
    });
    expect(hook.result.current.currentTime).toBe(0);
    expect(events.mock.calls.map(([event]) => event.type)).toEqual([
      'video-seek-start',
    ]);
    await act(async () => {
      callbacks.shift()!(0);
      callbacks.shift()!(16);
      await work;
    });
    expect(hook.result.current.currentTime).toBe(3);
    expect(events.mock.calls.map(([event]) => event.type)).toEqual([
      'video-seek-start',
      'video-seek-end',
    ]);
  } finally {
    hook.unmount();
    events.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('does not let an aborted reverse completion end a newer ordinary seek', async () => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const events = vi.spyOn(window, 'dispatchEvent');
  const params: Parameters<typeof useVideoTimeController>[0] = {
    videoList: [],
    syncData: undefined,
    syncMode: 'auto',
    mediaAngles: [],
  };
  const hook = renderHook(() => useVideoTimeController(params));
  try {
    let work!: Promise<void>;
    act(() => {
      work = hook.result.current.seekReverse(3, new AbortController().signal);
    });
    await act(async () => {
      hook.result.current.handleCurrentTime(new Event('seek'), 10);
      await expect(work).rejects.toThrow('REVERSE_CANCELLED');
    });
    expect(hook.result.current.currentTime).toBe(10);
    expect(events.mock.calls.map(([event]) => event.type)).toEqual([
      'video-seek-start',
      'video-seek-start',
    ]);
  } finally {
    hook.unmount();
    events.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('releases the confirmed clock gate when the requested video is unavailable', async () => {
  const params: Parameters<typeof useVideoTimeController>[0] = {
    videoList: ['missing.mp4'],
    syncData: undefined,
    syncMode: 'auto',
    mediaAngles: [],
  };
  const hook = renderHook(() => useVideoTimeController(params));
  try {
    await act(async () => {
      await expect(
        hook.result.current.seekReverse(3, new AbortController().signal),
      ).rejects.toThrow('REVERSE_VIDEO_UNAVAILABLE');
    });
    act(() => hook.result.current.setCurrentTime(1));
    expect(hook.result.current.currentTime).toBe(1);
  } finally {
    hook.unmount();
  }
});
