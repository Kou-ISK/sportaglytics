import { useCallback, useLayoutEffect, useRef } from 'react';

/** Read the committed package clock without resubscribing IPC on every frame. */
export const useCodingTime = (time: number | null): (() => number | null) => {
  const timeRef = useRef(time);
  useLayoutEffect(() => {
    timeRef.current = time;
  }, [time]);

  return useCallback(() => {
    const current = timeRef.current;
    return current !== null && Number.isFinite(current) ? current : null;
  }, []);
};
