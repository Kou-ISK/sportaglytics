import { useCallback, useEffect, useRef } from 'react';
import { HeldSeekQueue } from '../shared/media/heldSeekQueue';

export type ReversePlaybackRate = 0.5 | 2 | 4 | 6;
interface UseContinuousReversePlaybackParams {
  currentTime: number;
  minimumTime?: number;
  onPause: () => void;
  /** Resolves only after presentation, not IPC delivery/seek submission. */
  onSeek: (
    time: number,
    signal: AbortSignal,
  ) => void | number | null | Promise<void | number | null>;
  onError?: (error: unknown) => void;
}
interface ContinuousReversePlaybackController {
  startReversePlayback: (rate: ReversePlaybackRate, fromTime?: number) => void;
  stopReversePlayback: (discardPending?: boolean) => void;
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
  const rebaseAfterRelease = useRef(false);
  const reachedBound = useRef(false);
  type Gesture = {
    rate: ReversePlaybackRate;
    started: number;
    released: boolean;
    duration: number;
  };
  const waiting = useRef<Gesture[]>([]);
  const waitingActive = useRef<Gesture | null>(null);
  const draining = useRef(false);
  const startRef = useRef<
    (rate: ReversePlaybackRate, fromTime?: number) => void
  >(() => {});
  useEffect(() => {
    if (!active.current && (!queue.current || queue.current.settled))
      target.current = params.currentTime;
  }, [params.currentTime]);
  const stopReversePlayback = useCallback((discardPending = false): void => {
    active.current = false;
    if (discardPending && waitingActive.current) {
      const gesture = waitingActive.current;
      gesture.duration = Math.max(
        1 / 60,
        Math.min(0.1, (performance.now() - gesture.started) / 1000),
      );
      gesture.released = true;
      waitingActive.current = null;
    }
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    // A seek already issued may complete; do not start queued work after release.
    if (discardPending) {
      if (!reachedBound.current) queue.current?.discardPending();
      rebaseAfterRelease.current = true;
    }
  }, []);
  const cancelReversePlayback = useCallback((): void => {
    stopReversePlayback();
    generation.current++;
    waiting.current = [];
    waitingActive.current = null;
    draining.current = false;
    rebaseAfterRelease.current = false;
    reachedBound.current = false;
    queue.current?.cancel();
    queue.current = null;
  }, [stopReversePlayback]);
  const startReversePlayback = useCallback(
    (nextRate: ReversePlaybackRate, fromTime?: number): void => {
      rate.current = nextRate;
      if (active.current) {
        if (waitingActive.current) waitingActive.current.rate = nextRate;
        return; // A modifier change must not cancel useful decode.
      }
      const rebase = rebaseAfterRelease.current;
      const previousQueue = queue.current;
      if (
        rebase &&
        previousQueue &&
        (!previousQueue.settled ||
          draining.current ||
          waiting.current.length > 0)
      ) {
        if (waiting.current.length >= 8) {
          latest.current.onError?.(new Error('REVERSE_GESTURE_QUEUE_FULL'));
          return;
        }
        active.current = true;
        const waitGeneration = generation.current;
        latest.current.onPause();
        if (
          generation.current !== waitGeneration ||
          queue.current !== previousQueue
        )
          return;
        const gesture: Gesture = {
          rate: nextRate,
          started: performance.now(),
          released: false,
          duration: 0,
        };
        waiting.current.push(gesture);
        waitingActive.current = gesture;
        if (!draining.current) {
          draining.current = true;
          const run = generation.current;
          void (async () => {
            while (
              queue.current === previousQueue &&
              generation.current === run &&
              waiting.current.length
            ) {
              if (
                !(await previousQueue.whenIdle()) ||
                queue.current !== previousQueue ||
                generation.current !== run
              )
                return;
              const confirmed = previousQueue.confirmedTime;
              if (confirmed === null) {
                cancelReversePlayback();
                latest.current.onError?.(
                  new Error('REVERSE_CONFIRMED_TIME_UNAVAILABLE'),
                );
                return;
              }
              const next = waiting.current.shift();
              if (!next) break;
              if (!next.released) {
                waitingActive.current = null;
                active.current = false;
                draining.current = false;
                startRef.current(next.rate, confirmed);
                return;
              }
              target.current = calculateReversePlaybackTime(
                confirmed,
                next.rate,
                next.duration,
                latest.current.minimumTime ?? 0,
              );
              previousQueue.request(target.current);
            }
            if (queue.current === previousQueue && generation.current === run)
              draining.current = false;
          })();
        }
        return;
      }
      const lastConfirmed = previousQueue?.confirmedTime;
      if (rebase && previousQueue?.hasIssued && lastConfirmed === null) {
        cancelReversePlayback();
        latest.current.onError?.(
          new Error('REVERSE_CONFIRMED_TIME_UNAVAILABLE'),
        );
        return;
      }
      cancelReversePlayback();
      if (fromTime !== undefined) target.current = fromTime;
      else if (rebase)
        target.current = lastConfirmed ?? latest.current.currentTime;
      rebaseAfterRelease.current = false;
      active.current = true;
      const run = generation.current;
      latest.current.onPause();
      if (run !== generation.current) return;
      queue.current = new HeldSeekQueue(
        async (time, signal) => {
          return await latest.current.onSeek(time, signal);
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
            // Reaching the bound is not a key release: let the bound request drain.
            reachedBound.current = true;
            active.current = false;
            frame.current = null;
            return;
          }
        }
        previous = timestamp;
        frame.current = requestAnimationFrame(advance);
      };
      frame.current = requestAnimationFrame(advance);
    },
    [cancelReversePlayback],
  );
  startRef.current = startReversePlayback;
  useEffect(() => cancelReversePlayback, [cancelReversePlayback]);
  return {
    startReversePlayback,
    stopReversePlayback,
    cancelReversePlayback,
    isReverseSettled: () =>
      (queue.current?.settled ?? true) && waiting.current.length === 0,
  };
};
