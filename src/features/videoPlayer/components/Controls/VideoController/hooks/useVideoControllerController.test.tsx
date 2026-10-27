// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useVideoControllerController } from './useVideoControllerController';
import { claimNativePlayback } from '../../../../shared/nativePlayback/playbackAuthority';
const mocks = vi.hoisted(() => ({
  player: {
    currentTime: vi.fn(() => 0),
    readyState: vi.fn(() => 2),
    play: vi.fn(),
    pause: vi.fn(),
  },
}));
vi.mock('./useExistingVideoJsPlayer', () => ({
  useExistingVideoJsPlayer: () => () => mocks.player,
}));
vi.mock('./usePlaybackTimeTracker', () => ({
  usePlaybackTimeTracker: () => ({ videoTime: 0, setVideoTime: vi.fn() }),
}));
vi.mock('./useFlashStates', () => ({
  useFlashStates: () => ({ flashStates: {}, triggerFlash: vi.fn() }),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it('pauses a delayed HTML play completion after native takes ownership', async () => {
  vi.useFakeTimers();
  const played = Promise.withResolvers<void>();
  mocks.player.play.mockReturnValueOnce(played.promise);
  const hook = renderHook(() =>
    useVideoControllerController({
      setIsVideoPlaying: vi.fn(),
      isVideoPlaying: true,
      setVideoPlayBackRate: vi.fn(),
      videoPlayBackRate: 1,
      setCurrentTime: vi.fn(),
      currentTime: 0,
      handleCurrentTime: vi.fn(),
      maxSec: 20,
      videoList: ['synthetic.mp4'],
    }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(151);
  });
  expect(mocks.player.play).toHaveBeenCalledOnce();
  const release = claimNativePlayback();
  try {
    await act(async () => {
      played.resolve();
      await played.promise;
    });
    expect(mocks.player.pause).toHaveBeenCalledOnce();
  } finally {
    hook.unmount();
    release();
  }
});
