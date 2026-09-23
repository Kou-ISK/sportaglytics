// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoTimeController } from './useVideoTimeController';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: vi.fn(),
  setVideoJsPlayerCurrentTime: vi.fn(),
}));

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
