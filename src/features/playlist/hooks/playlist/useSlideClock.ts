import { useCallback, useLayoutEffect, useRef } from 'react';
import type { PlaylistItem } from '../../../../types/playlist/core';

/** Run from a monotonic clock only while this slide owns the player. */
export const useSlideClock = (item: PlaylistItem | null, playing: boolean,
  report: (time: number) => void, onEnd: () => void): ((time: number) => void) => {
  const id = item?.slide ? item.id : undefined;
  const duration = item?.slide ? item.endTime : 0;
  const elapsed = useRef(0);
  const since = useRef<number | null>(null);
  const finish = useRef(onEnd);
  useLayoutEffect(() => { finish.current = onEnd; }, [onEnd]);
  useLayoutEffect(() => {
    elapsed.current = 0;
    since.current = null;
    if (id) report(0);
  }, [id, duration, report]);
  useLayoutEffect(() => {
    if (!id || !playing) return;
    if (elapsed.current >= duration) elapsed.current = 0;
    since.current = performance.now();
    let frame = 0;
    const update = (): void => {
      if (since.current === null) return;
      const time = Math.min(duration, elapsed.current + (performance.now() - since.current) / 1000);
      report(time);
      if (time >= duration) {
        elapsed.current = duration;
        since.current = null;
        finish.current();
      } else frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      if (since.current !== null) elapsed.current = Math.min(duration,
        elapsed.current + (performance.now() - since.current) / 1000);
      since.current = null;
    };
  }, [id, duration, playing, report]);
  return useCallback((time) => {
    if (!id || !Number.isFinite(time)) return;
    elapsed.current = Math.min(duration, Math.max(0, time));
    if (since.current !== null) since.current = performance.now();
    report(elapsed.current);
  }, [duration, id, report]);
};
