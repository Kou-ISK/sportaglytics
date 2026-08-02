/* @vitest-environment jsdom */

import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import type Player from 'video.js/dist/types/player';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { videojsMock } = vi.hoisted(() => ({
  videojsMock:
    vi.fn<(element: HTMLVideoElement, options: unknown) => unknown>(),
}));

vi.mock('video.js', () => ({ default: videojsMock }));
vi.mock('videojs-youtube', () => ({}));

import { useVideoJsInitialization } from './useVideoJsInitialization';

interface HarnessProps {
  setIsReady: (value: boolean) => void;
  setDurationSec: (value: number) => void;
  setMaxSec: (value: number) => void;
}

const Harness = ({ setIsReady, setDurationSec, setMaxSec }: HarnessProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const initialMuteApplied = useRef(false);
  const techErrorHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const metadataHandlerRef = useRef<(() => void) | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const aspectRatioCallbackRef = useRef<((ratio: number) => void) | undefined>(
    undefined,
  );
  const lastReportedAspectRatioRef = useRef<number | null>(null);

  useVideoJsInitialization({
    id: 'video_0',
    videoSrc: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    allowSeek: false,
    setMaxSec,
    setIsReady,
    setDurationSec,
    containerRef,
    videoRef,
    playerRef,
    initialMuteApplied,
    techErrorHandlerRef,
    metadataHandlerRef,
    resizeHandlerRef,
    aspectRatioCallbackRef,
    lastReportedAspectRatioRef,
  });

  return (
    <div ref={containerRef}>
      <video ref={videoRef} id="video_0" />
    </div>
  );
};

describe('useVideoJsInitialization YouTube readiness', () => {
  let readyCallback: (() => void) | undefined;
  let durationValue: number;

  beforeEach(() => {
    vi.useFakeTimers();
    videojsMock.mockReset();
    durationValue = 0;
    readyCallback = undefined;

    videojsMock.mockImplementation((element) => {
      const player = {
        currentTime: vi.fn(() => 0),
        dispose: vi.fn(),
        duration: vi.fn(() => durationValue),
        el: vi.fn(() => element.parentElement),
        isDisposed: vi.fn(() => false),
        muted: vi.fn(),
        off: vi.fn(),
        on: vi.fn(),
        ready: vi.fn((callback: () => void) => {
          readyCallback = callback;
        }),
        src: vi.fn(),
      };
      return player;
    });
  });

  it('enables shared controls at tech ready and publishes duration after cue', () => {
    const setIsReady = vi.fn();
    const setDurationSec = vi.fn();
    const setMaxSec = vi.fn();

    const view = render(
      <Harness
        setIsReady={setIsReady}
        setDurationSec={setDurationSec}
        setMaxSec={setMaxSec}
      />,
    );

    expect(setIsReady).toHaveBeenCalledWith(true);
    expect(videojsMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        youtube: expect.objectContaining({
          customVars: {
            widget_referrer: 'https://com.kouisk.sportaglytics/',
          },
        }),
      }),
    );
    expect(readyCallback).toBeTypeOf('function');
    act(() => readyCallback?.());
    expect(setIsReady).toHaveBeenCalledWith(true);

    durationValue = 1_343.661;
    act(() => vi.advanceTimersByTime(250));

    expect(setDurationSec).toHaveBeenCalledWith(1_343.661);
    expect(setMaxSec).toHaveBeenCalledWith(1_343.661);

    view.unmount();
    vi.useRealTimers();
  });
});
