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
  videoSrc?: string;
  setIsReady: (value: boolean) => void;
  setDurationSec: (value: number) => void;
  setMaxSec: (value: number) => void;
}

const Harness = ({
  setIsReady,
  setDurationSec,
  setMaxSec,
  videoSrc = 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
}: HarnessProps) => {
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
    videoSrc,
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
  let metadataCallback: (() => void) | undefined;
  let disposeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    videojsMock.mockReset();
    durationValue = 0;
    readyCallback = undefined;
    metadataCallback = undefined;
    disposeMock = vi.fn();

    videojsMock.mockImplementation((element) => {
      const player = {
        currentTime: vi.fn(() => 0),
        dispose: disposeMock,
        duration: vi.fn(() => durationValue),
        el: vi.fn(() => element.parentElement),
        isDisposed: vi.fn(() => false),
        muted: vi.fn(),
        off: vi.fn(),
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'loadedmetadata') metadataCallback = callback;
        }),
        ready: vi.fn((callback: () => void) => {
          readyCallback = callback;
        }),
        src: vi.fn(),
      };
      return player;
    });
  });

  it('keeps a loading player across reporting callback changes and reports to the latest callback', () => {
    const initial = {
      setIsReady: vi.fn(),
      setDurationSec: vi.fn(),
      setMaxSec: vi.fn(),
    };
    const latest = {
      setIsReady: vi.fn(),
      setDurationSec: vi.fn(),
      setMaxSec: vi.fn(),
    };
    const view = render(
      <Harness {...initial} videoSrc="file:///match-a.mp4" />,
    );
    view.rerender(<Harness {...latest} videoSrc="file:///match-a.mp4" />);
    expect(videojsMock).toHaveBeenCalledTimes(1);
    expect(disposeMock).not.toHaveBeenCalled();

    durationValue = 120;
    act(() => metadataCallback?.());
    expect(latest.setMaxSec).toHaveBeenCalledWith(120);
    expect(latest.setDurationSec).toHaveBeenCalledWith(120);
    expect(latest.setIsReady).toHaveBeenCalledWith(true);
    expect(initial.setMaxSec).not.toHaveBeenCalled();

    view.rerender(<Harness {...latest} videoSrc="file:///match-b.mp4" />);
    expect(videojsMock).toHaveBeenCalledTimes(2);
    expect(disposeMock).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(disposeMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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
