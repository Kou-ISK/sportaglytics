// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  CaptureSnapshot,
  ILiveCaptureAPI,
} from '../../../../types/liveCapture';
import { useLiveCapturePlayback } from './useLiveCapturePlayback';

const snapshot = (seconds: number): CaptureSnapshot => ({
  id: 'capture',
  packagePath: '/matches/live.stpkg',
  name: 'Live',
  phase: 'recording',
  elapsedSeconds: seconds + 2,
  availableEndSeconds: seconds,
  inputs: [
    {
      id: 'one',
      name: 'One',
      kind: 'device',
      phase: 'recording',
      segmentCount: seconds / 2,
      recordedSeconds: seconds,
    },
  ],
  mediaAngles: [
    {
      id: 'one',
      name: 'One',
      sourceKind: 'local',
      clips: Array.from({ length: seconds / 2 }, (_, index) => ({
        id: `clip-${index}`,
        sourceKind: 'local',
        source: `media/${index}.mp4`,
        timelineStartSeconds: index * 2,
        durationSeconds: 2,
        gapBeforeSeconds: 0,
      })),
    },
  ],
});
afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});
it('appends segments, ignores stale snapshots, and leaves a reviewed clock alone until Go Live', async () => {
  let receive: (state: CaptureSnapshot | null) => void = () => {};
  let resolveInitial: (state: CaptureSnapshot | null) => void = () => {};
  const off = vi.fn();
  const api: Pick<ILiveCaptureAPI, 'onState' | 'getState'> = {
    onState: (callback) => {
      receive = callback;
      return off;
    },
    getState: () =>
      new Promise((resolve) => {
        resolveInitial = resolve;
      }),
  };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { liveCapture: api },
  });
  const onSeek = vi.fn();
  const setMediaAngles = vi.fn();
  const setPlaying = vi.fn();
  const args = {
    packagePath: '/matches/live.stpkg',
    currentTime: 0,
    isPlaying: false,
    maxSec: 6,
    setMediaAngles,
    setVideoList: vi.fn(),
    onSeek,
    setPlaying,
    setRate: vi.fn(),
  };
  const hook = renderHook((params) => useLiveCapturePlayback(params), {
    initialProps: args,
  });
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' })));
  act(() => receive(snapshot(8)));
  expect(onSeek).toHaveBeenLastCalledWith(expect.any(Event), 4);
  expect(setPlaying).toHaveBeenLastCalledWith(true);
  await act(async () => resolveInitial(snapshot(2)));
  expect(setMediaAngles).toHaveBeenCalledTimes(1);
  hook.rerender({ ...args, currentTime: 3 });
  onSeek.mockClear();
  act(() => receive(snapshot(12)));
  expect(onSeek).not.toHaveBeenCalled();
  expect(hook.result.current.timelineState?.following).toBe(false);
  act(() => hook.result.current.goLive());
  expect(onSeek).toHaveBeenLastCalledWith(expect.any(Event), 8);
  hook.unmount();
  expect(off).toHaveBeenCalledTimes(1);
});
