import { useCallback, useEffect, useRef } from 'react';

export type ReversePlaybackRate = 0.5 | 2 | 4 | 6;

interface UseContinuousReversePlaybackParams {
  currentTime: number;
  minimumTime?: number;
  onPause: () => void;
  onSeek: (time: number) => void;
}

interface ContinuousReversePlaybackController {
  startReversePlayback: (rate: ReversePlaybackRate) => void;
  stopReversePlayback: () => void;
}

const MAX_FRAME_DELTA_SECONDS = 0.1;

export const calculateReversePlaybackTime = (
  currentTime: number,
  rate: ReversePlaybackRate,
  elapsedSeconds: number,
  minimumTime: number,
): number => {
  const safeElapsed = Math.min(
    MAX_FRAME_DELTA_SECONDS,
    Math.max(0, elapsedSeconds),
  );
  return Math.max(minimumTime, currentTime - safeElapsed * rate);
};

export const useContinuousReversePlayback = ({
  currentTime,
  minimumTime = 0,
  onPause,
  onSeek,
}: UseContinuousReversePlaybackParams): ContinuousReversePlaybackController => {
  const activeRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const currentTimeRef = useRef(currentTime);
  const minimumTimeRef = useRef(minimumTime);
  const onPauseRef = useRef(onPause);
  const onSeekRef = useRef(onSeek);

  minimumTimeRef.current = minimumTime;
  onPauseRef.current = onPause;
  onSeekRef.current = onSeek;

  useEffect(() => {
    if (!activeRef.current) {
      currentTimeRef.current = currentTime;
    }
  }, [currentTime]);

  const stopReversePlayback = useCallback((): void => {
    activeRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const startReversePlayback = useCallback(
    (rate: ReversePlaybackRate): void => {
      stopReversePlayback();
      activeRef.current = true;
      onPauseRef.current();
      let previousTimestamp: number | null = null;

      const advance = (timestamp: number): void => {
        if (!activeRef.current) return;

        if (previousTimestamp !== null) {
          const nextTime = calculateReversePlaybackTime(
            currentTimeRef.current,
            rate,
            (timestamp - previousTimestamp) / 1000,
            minimumTimeRef.current,
          );
          currentTimeRef.current = nextTime;
          onSeekRef.current(nextTime);

          if (nextTime <= minimumTimeRef.current) {
            activeRef.current = false;
            frameRef.current = null;
            return;
          }
        }

        previousTimestamp = timestamp;
        frameRef.current = requestAnimationFrame(advance);
      };

      frameRef.current = requestAnimationFrame(advance);
    },
    [stopReversePlayback],
  );

  useEffect(() => stopReversePlayback, [stopReversePlayback]);

  return { startReversePlayback, stopReversePlayback };
};
