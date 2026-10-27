// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { SyncedVideoPlayer } from '../../components/Player/SyncedVideo/SyncedVideoPlayer';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
import { restoreNativeOriginal } from '../../shared/nativePlayback/nativeOriginalRecovery';
import { bindNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { claimNativePlayback } from '../../shared/nativePlayback/playbackAuthority';
import { useNativePlaybackRestoration } from './useNativePackageClock';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import type {
  NativePlaybackSnapshot,
  NativePlaybackClosed,
} from '../../../../types/ipc/nativePlayback';

vi.mock('../../../../shared/hooks/useVideoWindowAspect', () => ({
  useVideoWindowAspect: vi.fn(),
}));
vi.mock(
  '../../components/Player/SyncedVideo/hooks/useSyncedVideoPlayer',
  () => ({
    useSyncedVideoPlayer: () => ({
      blockPlayStates: [],
      aspectRatios: [],
      handleAspectRatioChange: vi.fn(),
    }),
  }),
);
// The media decoder is a port fixture. Keep the actual SyncedVideoPlayer and
// NativeSurfaceController lifecycle so an endpoint unmount cannot be hidden.
vi.mock('../../components/Player/SingleVideoPlayer', async () => {
  const { NativeSurfaceController } =
    await import('../../components/NativePlayback/NativeSurfaceController');
  return {
    MemoizedSingleVideoPlayer: ({
      id,
      videoSrc,
    }: {
      id: string;
      videoSrc: string;
    }): ReactElement => (
      <div data-testid="media-player">
        <NativeSurfaceController
          id={id}
          source={videoSrc}
          mount={document.body}
        />
      </div>
    ),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([0.00000033333333, 0.00020033333333])(
  'commits qualified End discrepancy %s without detaching the surface before recovery releases ownership',
  async (difference) => {
    vi.useFakeTimers();
    const releaseSurface = vi.fn();
    vi.stubGlobal('electronAPI', {
      nativeSurface: { bind: vi.fn(() => releaseSurface) },
    });
    const source = 'file:///synthetic.mp4';
    const duration = 120.123456,
      end = duration + difference;
    let time = 119;
    const settings = {
      rate: 1,
      volume: 0.5,
      muted: true,
      audio: [true, false, false],
    };
    const port: CachePlayerPort = {
      source: () => source,
      paused: () => true,
      time: () => time,
      duration: () => duration,
      ready: () => 2,
      seeking: () => false,
      pause: vi.fn(),
      setSource: vi.fn(),
      seek: vi.fn((next) => {
        time = next;
      }),
      settings: () => settings,
      restore: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    let restored: (
      value: number,
      controls: NativePlaybackControls,
    ) => void = () => {
      throw Error('not mounted');
    };
    const Harness = (): ReactElement => {
      const [clock, setClock] = useState(119);
      const [playing, setPlaying] = useState(false);
      const [rate, setRate] = useState(1);
      restored = useNativePlaybackRestoration(setClock, setRate, setPlaying);
      return (
        <>
          <output data-testid="clock">{clock}</output>
          <SyncedVideoPlayer
            videoList={[source]}
            currentTime={clock}
            isVideoPlaying={playing}
            videoPlayBackRate={rate}
            setMaxSec={vi.fn()}
            mediaAngles={[
              {
                id: 'a',
                name: 'Synthetic',
                sourceKind: 'local',
                clips: [
                  {
                    id: 'c',
                    sourceKind: 'local',
                    source,
                    timelineStartSeconds: 0,
                    durationSeconds: end,
                    gapBeforeSeconds: 0,
                  },
                ],
              },
            ]}
          />
        </>
      );
    };
    const view = render(<Harness />);
    const originalPlayer = screen.getByTestId('media-player');
    const owner = { generation: 'endpoint', sourceKey: 'a'.repeat(64) };
    let notify: ((value: NativePlaybackSnapshot) => void) | undefined;
    const releaseLease = claimNativePlayback();
    let unbind = (): void => {};
    const controller = new NativePlaybackController(
      {
        inspect: vi.fn(),
        open: vi.fn(async () => {}),
        onSnapshot: vi.fn((_owner, listener) => {
          notify = listener;
          return () => {
            notify = undefined;
          };
        }),
        apply: vi.fn(async (intent) => {
          notify?.({
            intent,
            observation: {
              ...owner,
              sequence: 1,
              seekId: 1,
              revision: 1,
              time: 119,
              rate: 0,
              phase: 'paused',
              audioTrack: 0,
              volume: 0.5,
              muted: true,
              videoReady: true,
              audioReady: true,
              error: null,
            },
            lastConfirmedTime: 119,
            error: null,
            closing: false,
            closed: false,
          });
        }),
        observe: vi.fn(async () => ({
          intent: null,
          observation: null,
          lastConfirmedTime: 119,
          error: null,
          closing: false,
          closed: false,
        })),
        close: vi.fn(
          async (): Promise<NativePlaybackClosed> => ({
            generation: owner.generation,
            nativeDrained: true,
            processStarted: true,
            processExited: true,
            pipesClosed: true,
            stopped: { ...owner, sequence: 1, seekId: 1, time: 119, rate: 0 },
          }),
        ),
      },
      owner,
      source,
      119,
      { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true },
      {
        pause: vi.fn(),
        restore: (value, _controls, signal) =>
          restoreNativeOriginal(
            port,
            source,
            { time: value, settings, sourceEnd: end },
            3,
            signal,
          ),
        restored: (value, controls) => restored(value, controls),
        release: () => {
          unbind();
          releaseLease();
        },
      },
      {
        width: 1920,
        height: 1080,
        start: 0,
        end,
        seekEnd: 119.5,
        playEnd: 120,
        rates: [1],
        audioTracks: 3,
        seekGrid: null,
        mutedOnly: true,
        exactFloatVolume: true,
        audioSwitch: true,
      },
    );
    await act(async () => {
      unbind = bindNativePlayback(controller);
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      controller.seek(end);
      await controller.returnToOriginal();
    });
    expect(controller.snapshot()).toMatchObject({
      phase: 'original',
      time: end,
      error: null,
    });
    expect(screen.getByTestId('clock').textContent).toBe(String(end));
    expect(screen.getByTestId('media-player')).toBe(originalPlayer);
    expect(port.seek).toHaveBeenCalledWith(duration);
    expect(releaseSurface).not.toHaveBeenCalled();
    expect(port.restore).toHaveBeenCalledWith(settings, 3);
    view.unmount();
  },
);
