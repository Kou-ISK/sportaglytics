import { useCallback, useEffect, useRef } from 'react';
import { HeldSeekQueue } from '../shared/media/heldSeekQueue';

export type ReversePlaybackRate = 0.5 | 2 | 4 | 6;
interface UseContinuousReversePlaybackParams {
  currentTime: number;
  minimumTime?: number;
  onPause: () => void;
  /** Resolves only after presentation, not IPC delivery/seek submission. */
  onSeek: (time: number, signal: AbortSignal) => void | Promise<void>;
  onError?: (error: unknown) => void;
}
interface ContinuousReversePlaybackController {
  startReversePlayback: (rate: ReversePlaybackRate, fromTime?: number) => void;
  stopReversePlayback: () => void;
  cancelReversePlayback: () => void;
  isReverseSettled: () => boolean;
}
export const calculateReversePlaybackTime = (
  currentTime: number,
  rate: ReversePlaybackRate,
  elapsedSeconds: number,
  minimumTime: number,
): number =>
  Math.max(
    minimumTime,
    currentTime - Math.min(0.1, Math.max(0, elapsedSeconds)) * rate,
  );

export const useContinuousReversePlayback = (
  params: UseContinuousReversePlaybackParams,
): ContinuousReversePlaybackController => {
  const latest = useRef(params);
  latest.current = params;
  const active = useRef(false);
  const generation = useRef(0);
  const frame = useRef<number | null>(null);
  const target = useRef(params.currentTime);
  const rate = useRef<ReversePlaybackRate>(0.5);
  const queue = useRef<HeldSeekQueue | null>(null);
  useEffect(() => {
    if (!active.current && (!queue.current || queue.current.settled))
      target.current = params.currentTime;
  }, [params.currentTime]);
  const stopReversePlayback = useCallback((): void => {
    active.current = false;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    // Release stops input only. The queue drains to the last desired position.
  }, []);
  const cancelReversePlayback = useCallback((): void => {
    stopReversePlayback();
    generation.current++;
    queue.current?.cancel();
    queue.current = null;
  }, [stopReversePlayback]);
  const startReversePlayback = useCallback(
    (nextRate: ReversePlaybackRate, fromTime?: number): void => {
      rate.current = nextRate;
      if (active.current) return; // A modifier change must not cancel useful decode.
      cancelReversePlayback();
      if (fromTime !== undefined) target.current = fromTime;
      active.current = true;
      const run = generation.current;
      latest.current.onPause();
      if (run !== generation.current) return;
      queue.current = new HeldSeekQueue(
        async (time, signal) => {
          await latest.current.onSeek(time, signal);
        },
        (error) => {
          cancelReversePlayback();
          latest.current.onError?.(error);
        },
      );
      let previous: number | null = null;
      const advance = (timestamp: number): void => {
        if (!active.current || run !== generation.current) return;
        if (previous !== null) {
          target.current = calculateReversePlaybackTime(
            target.current,
            rate.current,
            (timestamp - previous) / 1000,
            latest.current.minimumTime ?? 0,
          );
          queue.current?.request(target.current);
          if (!active.current || run !== generation.current) return;
          if (target.current <= (latest.current.minimumTime ?? 0)) {
            stopReversePlayback();
            return;
          }
        }
        previous = timestamp;
        frame.current = requestAnimationFrame(advance);
      };
      frame.current = requestAnimationFrame(advance);
    },
    [cancelReversePlayback, stopReversePlayback],
  );
  useEffect(() => cancelReversePlayback, [cancelReversePlayback]);
  return {
    startReversePlayback,
    stopReversePlayback,
    cancelReversePlayback,
    isReverseSettled: () => queue.current?.settled ?? true,
  };
};
