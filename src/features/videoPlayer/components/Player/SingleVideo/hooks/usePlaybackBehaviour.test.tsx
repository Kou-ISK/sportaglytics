/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import type Player from 'video.js/dist/types/player';
import { expect, it, vi } from 'vitest';
import { usePlaybackBehaviour } from './usePlaybackBehaviour';
import { claimNativePlayback } from '../../../../shared/nativePlayback/playbackAuthority';

it('does not let an old play completion pause a new legitimate original play', async () => {
  const old = Promise.withResolvers<void>();
  const root = document.createElement('div');
  const play = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue(undefined);
  const pause = vi.fn();
  // Partial Video.js adapter for promise ordering; no real media is played.
  const ref = {
    current: {
      el: () => root,
      paused: () => true,
      isDisposed: () => false,
      play,
      pause,
      playbackRate: () => 1,
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as Player,
  };
  const hook = renderHook(
    ({ playing }) =>
      usePlaybackBehaviour({
        playerRef: ref,
        id: 'video_0',
        isReady: true,
        isVideoPlaying: playing,
        blockPlay: false,
        videoPlayBackRate: 1,
        durationSec: 0,
        setShowEndMask: vi.fn(),
        allowSeek: false,
      }),
    { initialProps: { playing: true } },
  );
  let release!: () => void;
  act(() => {
    release = claimNativePlayback();
  });
  hook.rerender({ playing: false });
  act(() => release());
  hook.rerender({ playing: true });
  await act(async () => {
    await Promise.resolve();
  });
  const pauses = pause.mock.calls.length;
  await act(async () => {
    old.resolve();
    await old.promise;
  });
  expect(pause).toHaveBeenCalledTimes(pauses);
  hook.unmount();
});

it('cancels pending canplay retries when the user releases a paused playback key', () => {
  const root = document.createElement('div');
  const video = document.createElement('video');
  root.appendChild(video);
  Object.defineProperty(video, 'readyState', { value: 1, configurable: true });
  const listeners = new Map<string, () => void>();
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  // This test double implements only the Video.js surface used by this hook.
  const player = {
    el: () => root,
    paused: () => true,
    isDisposed: () => false,
    play,
    pause,
    playbackRate: () => 1,
    on: (event: string, listener: () => void) => listeners.set(event, listener),
    off: (event: string) => listeners.delete(event),
  } as unknown as Player;
  const ref = { current: player };
  const { rerender } = renderHook(
    ({ playing }) =>
      usePlaybackBehaviour({
        playerRef: ref,
        id: 'video_0',
        isReady: true,
        isVideoPlaying: playing,
        blockPlay: false,
        videoPlayBackRate: 1,
        durationSec: 0,
        setShowEndMask: vi.fn(),
        allowSeek: false,
      }),
    { initialProps: { playing: true } },
  );
  const pending = listeners.get('canplay');
  expect(pending).toBeDefined();
  rerender({ playing: false });
  expect(listeners.has('canplay')).toBe(false);
  Object.defineProperty(video, 'readyState', { value: 4 });
  act(() => pending?.());
  expect(pause).toHaveBeenCalled();
  expect(play).not.toHaveBeenCalled();
});
