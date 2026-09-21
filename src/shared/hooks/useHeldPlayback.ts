import { useCallback, useLayoutEffect, useRef } from 'react';

interface PlaybackState {
  playing: boolean;
  rate: number;
}

/** A temporary speed key restores the state from before the first press. */
export const useHeldPlayback = (
  read: () => PlaybackState,
  apply: (state: PlaybackState) => void,
): {
  start: (id: string, rate: number) => void;
  stop: (id: string) => void;
  cancel: () => void;
} => {
  const callbacks = useRef({ read, apply });
  useLayoutEffect(() => {
    callbacks.current = { read, apply };
  }, [read, apply]);
  const session = useRef<{ id: string; previous: PlaybackState } | null>(null);
  const start = useCallback((id: string, rate: number): void => {
    const previous = session.current?.previous ?? callbacks.current.read();
    session.current = { id, previous };
    callbacks.current.apply({ playing: true, rate });
  }, []);
  const stop = useCallback((id: string): void => {
    if (session.current?.id !== id) return;
    const previous = session.current.previous;
    session.current = null;
    callbacks.current.apply(previous);
  }, []);
  const cancel = useCallback((): void => {
    const previous = session.current?.previous;
    session.current = null;
    if (previous)
      callbacks.current.apply({
        ...callbacks.current.read(),
        rate: previous.rate,
      });
  }, []);
  return { start, stop, cancel };
};
