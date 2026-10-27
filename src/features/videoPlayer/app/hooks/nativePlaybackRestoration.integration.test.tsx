// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import { bindNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { claimNativePlayback } from '../../shared/nativePlayback/playbackAuthority';
import { useMediaTimeSync } from '../../components/Player/SingleVideo/hooks/useMediaTimeSync';
import { useNativePlaybackRestoration } from './useNativePackageClock';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';
import type {
  NativePlaybackIntent,
  NativePlaybackSnapshot,
} from '../../../../types/ipc/nativePlayback';

vi.mock('./packagePlaybackReadiness', () => ({
  isPackageMediaBuffering: vi.fn(() => false),
  demandPackagePlaybackRanges: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([true, false])(
  'commits the final source clock before HTML release (resume=%s)',
  async (playing) => {
    vi.useFakeTimers();
    let frame: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
      frame = next;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const stopped = 8.375;
    let htmlTime = 3;
    const seek = vi.fn((time?: number) => {
      if (time !== undefined) htmlTime = time;
      return htmlTime;
    });
    const playerRef = {
      current: {
        currentTime: seek,
        seeking: () => false,
        on: vi.fn(),
        off: vi.fn(),
      },
    };
    const owner = { generation: 'recovery', sourceKey: 'a'.repeat(64) };
    let notify: ((value: NativePlaybackSnapshot) => void) | null = null;
    let appliedSequence = 1;
    let atRelease: { time: number; playing: boolean; rate: number } | null =
      null;
    let restoreState: (
      time: number,
      controls: NativePlaybackControls,
    ) => void = () => {
      throw Error('hook not mounted');
    };
    const release = claimNativePlayback();
    let unbind = (): void => {};
    const controller = new NativePlaybackController(
      {
        inspect: vi.fn(),
        open: vi.fn(async () => {}),
        apply: vi.fn(async (intent: NativePlaybackIntent) => {
          appliedSequence = intent.sequence;
          notify?.({
            intent,
            observation: {
              ...owner,
              sequence: intent.sequence,
              seekId: intent.seekId,
              audioTrack: intent.audioTrack,
              volume: intent.volume,
              muted: intent.muted,
              revision: intent.sequence,
              time: 3,
              phase: intent.playing ? 'playing' : 'paused',
              rate: intent.playing ? intent.rate : 0,
              videoReady: true,
              audioReady: true,
              error: null,
            },
            lastConfirmedTime: 3,
            error: null,
            closing: false,
            closed: false,
          });
        }),
        observe: vi.fn(async () => ({
          intent: null,
          observation: null,
          lastConfirmedTime: 3,
          error: null,
          closing: false,
          closed: false,
        })),
        onSnapshot: vi.fn((_owner, listener) => {
          notify = listener;
          return () => {
            notify = null;
          };
        }),
        close: vi.fn(async () => ({
          generation: owner.generation,
          nativeDrained: true,
          processStarted: true,
          processExited: true,
          pipesClosed: true,
          stopped: {
            ...owner,
            sequence: appliedSequence,
            seekId: 1,
            time: stopped,
            rate: 0 as const,
          },
        })),
      },
      owner,
      'file:///synthetic.mp4',
      3,
      { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true },
      {
        pause: vi.fn(),
        restore: async (time) => {
          htmlTime = time;
        },
        restored: (time, controls) => restoreState(time, controls),
        release: () => {
          const { time, playing, rate } = hook.result.current;
          atRelease = { time, playing, rate };
          unbind();
          release();
        },
      },
      {
        width: 1920,
        height: 1080,
        start: 0,
        end: 20,
        seekEnd: 19,
        playEnd: 19.5,
        rates: [1],
        audioTracks: 3,
        seekGrid: { origin: 0, duration: 1, timescale: 25 },
        mutedOnly: true,
        exactFloatVolume: true,
        audioSwitch: false,
      },
    );
    unbind = bindNativePlayback(controller);
    const hook = renderHook(() => {
      const [time, setTime] = useState(3);
      const [isPlaying, setPlaying] = useState(playing);
      const [rate, setRate] = useState(1);
      restoreState = useNativePlaybackRestoration(setTime, setRate, setPlaying);
      usePackagePlaybackClock({
        mediaAngles: [
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
        ],
        syncMode: 'auto',
        isVideoPlaying: isPlaying,
        videoPlayBackRate: rate,
        currentTime: time,
        setCurrentTime: setTime,
        setIsVideoPlaying: setPlaying,
        setMaxSec: vi.fn(),
      });
      useMediaTimeSync(playerRef, true, time, isPlaying, rate);
      return { time, playing: isPlaying, rate, setRate };
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(controller.snapshot().phase).toBe('active');
    expect(controller.hasConfirmedSeek).toBe(true);
    // An unsupported speed uses the product recovery, with the last desired
    // play/pause retained. Native stops later than the last React timestamp.
    act(() => hook.result.current.setRate(6));
    await act(async () => {
      await controller.returnToOriginal();
    });
    expect(controller.snapshot().phase).toBe('original');
    expect(atRelease).toEqual({ time: stopped, playing, rate: 6 });
    expect(seek.mock.calls.filter(([time]) => time !== undefined)).toEqual([]);
    if (playing) {
      act(() => {
        frame(100);
        frame(116);
      });
      expect(hook.result.current.time).toBeCloseTo(stopped + 0.016 * 6, 8);
    } else expect(hook.result.current.time).toBe(stopped);
    expect(seek.mock.calls.filter(([time]) => time !== undefined)).toEqual([]);
    hook.unmount();
  },
);
