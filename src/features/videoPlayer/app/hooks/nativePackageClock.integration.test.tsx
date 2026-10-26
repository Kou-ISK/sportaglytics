// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { NativePlaybackManager } from '../../../../../electron/src/nativePlayback/nativePlaybackManager';
import { createNativePlaybackBridge } from '../../../../../electron/src/preload/nativePlaybackBridge';
import {
  nativePlaybackChannels as channels,
  parseNativePlaybackIntent,
  parseNativePlaybackOwner,
} from '../../../../types/ipc/nativePlayback';
import type { NativePlaybackIntent } from '../../../../types/ipc/nativePlayback';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import { bindNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import {
  claimNativePlayback,
  htmlPlaybackAllowed,
} from '../../shared/nativePlayback/playbackAuthority';
import { useVideoTimeController } from './useVideoTimeController';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';
vi.mock('./packagePlaybackReadiness', () => ({
  isPackageMediaBuffering: vi.fn(() => false),
  demandPackagePlaybackRanges: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('routes shared clock/seek/audio through product bridge and Main without changing package/tag/export metadata', async () => {
  vi.useFakeTimers();
  const raf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const commands: NativePlaybackIntent[] = [];
  let revision = 0;
  let seekId = 0;
  let holdSeek = false;
  let acknowledgeSeek: (() => void) | null = null;
  let publish: ((value: unknown) => void) | null = null;
  const manager = new NativePlaybackManager({
    publish: (owner, snapshot) => publish?.({ owner, snapshot, delivery: 1 }),
    context: () => 'bound-document',
    qualify: async () => ({
      sourceKey: 'a'.repeat(64),
      sourceUrl: 'file:///synthetic.mp4',
      sourceEnd: null,
      scope: { start: 0, end: 20, audioTracks: 3, rates: [1] },
      assertCurrent: async () => {},
      createBackend: (owner, observe) => ({
        write: async (value) => {
          commands.push(value);
          const event = {
            ...owner,
            revision: ++revision,
            sequence: value.sequence,
            seekId: value.seekId,
            phase: 'paused',
            time: value.targetTime,
            rate: 0,
            audioTrack: value.audioTrack,
            volume: value.volume,
            muted: value.muted,
            videoReady: true,
            audioReady: true,
            error: null,
          };
          const acknowledge = (): void => {
            if (seekId !== value.seekId) {
              seekId = value.seekId;
              observe(event);
            }
            observe({
              ...event,
              revision: ++revision,
              phase: value.playing ? 'playing' : 'paused',
              rate: value.playing ? value.rate : 0,
              time: value.targetTime + (value.playing ? 0.2 : 0),
            });
          };
          if (holdSeek) acknowledgeSeek = acknowledge;
          else acknowledge();
        },
        close: async () => ({
          generation: owner.generation,
          nativeDrained: true,
          processStarted: true,
          processExited: true,
          pipesClosed: true,
          stopped: commands.length
            ? {
                ...owner,
                sequence: commands.at(-1)!.sequence,
                seekId: commands.at(-1)!.seekId,
                time:
                  commands.at(-1)!.targetTime +
                  (commands.at(-1)!.playing ? 0.2 : 0),
                rate: 0,
              }
            : null,
        }),
      }),
    }),
  });
  // This adapter is an in-process IPC simulation, not a BrowserWindow/CUA test.
  const bridge = createNativePlaybackBridge({
    acknowledge: () => {},
    subscribe: (listener) => {
      publish = listener;
      return () => {
        publish = null;
      };
    },
    invoke: async (channel, value) => {
      switch (channel) {
        case channels.inspect:
          return manager.inspect();
        case channels.open:
          return manager.open(parseNativePlaybackOwner(value));
        case channels.apply:
          return manager.apply(parseNativePlaybackIntent(value));
        case channels.observe:
          return manager.observe(parseNativePlaybackOwner(value));
        case channels.close:
          return manager.close(parseNativePlaybackOwner(value));
        default:
          throw Error('unregistered channel');
      }
    },
  });
  const availability = await bridge.inspect();
  if (!availability.owner) throw Error('owner');
  const release = claimNativePlayback();
  let unbind: () => void = () => {};
  const restored = vi.fn(async () => {});
  const controller = new NativePlaybackController(
    bridge,
    availability.owner,
    'file:///synthetic.mp4',
    3,
    { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true },
    {
      pause: vi.fn(),
      restore: restored,
      release: () => {
        unbind();
        release();
      },
    },
  );
  unbind = bindNativePlayback(controller);
  const mediaAngles: PackageMediaAngle[] = [
    {
      id: 'one',
      name: 'Synthetic',
      sourceKind: 'local',
      clips: [
        {
          id: 'clip',
          sourceKind: 'local',
          source: '/synthetic.mp4',
          timelineStartSeconds: 0,
          durationSeconds: 20,
          gapBeforeSeconds: 0,
        },
      ],
    },
  ];
  const original = JSON.stringify(mediaAngles);
  const hook = renderHook(() => {
    const timeController = useVideoTimeController({
      videoList: ['file:///synthetic.mp4'],
      syncData: undefined,
      syncMode: 'auto',
      mediaAngles,
    });
    const { currentTime: time, setCurrentTime: setTime } = timeController;
    const [playing, setPlaying] = useState(false);
    const clock = usePackagePlaybackClock({
      mediaAngles,
      syncMode: 'auto',
      isVideoPlaying: playing,
      videoPlayBackRate: 1,
      currentTime: time,
      setCurrentTime: setTime,
      setIsVideoPlaying: setPlaying,
      setMaxSec: vi.fn(),
    });
    return { time, playing, setPlaying, clock, timeController };
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(hook.result.current.clock.useTimelineClock).toBe(true);
  expect(raf).not.toHaveBeenCalled();
  act(() => hook.result.current.setPlaying(true));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(hook.result.current.time).toBe(3.2);
  const before = commands.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(commands).toHaveLength(before);
  holdSeek = true;
  act(() => {
    hook.result.current.setPlaying(false);
    hook.result.current.timeController.handleCurrentTime(
      new Event('physical-scrub'),
      8,
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(hook.result.current.time).toBe(3.2);
  expect(controller.hasConfirmedSeek).toBe(false);
  expect(commands.at(-1)?.targetTime).toBe(8);
  holdSeek = false;
  if (!acknowledgeSeek) throw Error('missing held seek');
  act(() => acknowledgeSeek?.());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(hook.result.current.time).toBe(8);
  act(() => controller.controls({ audioTrack: 2, volume: 0.25 }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(commands.at(-1)).toMatchObject({
    audioTrack: 2,
    targetTime: 8,
    playing: false,
    volume: 0.25,
  });
  expect(JSON.stringify(mediaAngles)).toBe(original);
  expect(htmlPlaybackAllowed()).toBe(false);
  await act(async () => {
    await controller.returnToOriginal();
  });
  expect(restored).toHaveBeenCalledWith(
    8,
    expect.objectContaining({ audioTrack: 2, playing: false }),
    expect.any(AbortSignal),
  );
  expect(htmlPlaybackAllowed()).toBe(true);
  hook.unmount();
});
