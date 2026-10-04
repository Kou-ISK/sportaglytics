import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineData } from '../../../../types/timeline/core';

interface TimelineHistoryState {
  past: TimelineData[][];
  present: TimelineData[];
  future: TimelineData[][];
}
interface UseTimelineHistoryReturn {
  timeline: TimelineData[];
  canUndo: boolean;
  canRedo: boolean;
  setTimeline: (timeline: TimelineData[]) => void;
  undo: () => TimelineData[] | null;
  redo: () => TimelineData[] | null;
  clearHistory: () => void;
}
const MAX_HISTORY_SIZE = 50;

export function useTimelineHistory(
  initialTimeline: TimelineData[] = [],
  resetKey = 0,
): UseTimelineHistoryReturn {
  const [state, setState] = useState<TimelineHistoryState>({
    past: [],
    present: initialTimeline,
    future: [],
  });
  // Commands must synchronously return the document to persist, even when React
  // batches rendering. Never obtain that result from a deferred state updater.
  const current = useRef(state);
  const previousInput = useRef(JSON.stringify(initialTimeline));
  const previousResetKey = useRef(resetKey);
  const apply = useCallback((next: TimelineHistoryState): void => {
    current.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const input = JSON.stringify(initialTimeline);
    if (resetKey !== previousResetKey.current) {
      previousResetKey.current = resetKey;
      previousInput.current = input;
      apply({ past: [], present: initialTimeline, future: [] });
      return;
    }
    if (input === previousInput.current) return;
    previousInput.current = input;
    // A persistence echo of our own edit/Undo keeps history. A loaded document
    // replaces it, so Undo cannot cross into a different package.
    if (input !== JSON.stringify(current.current.present)) {
      apply({ past: [], present: initialTimeline, future: [] });
    }
  }, [initialTimeline, resetKey, apply]);

  const setTimeline = useCallback(
    (next: TimelineData[]): void => {
      const previous = current.current;
      if (next === previous.present) return;
      apply({
        past: [...previous.past, previous.present].slice(-MAX_HISTORY_SIZE),
        present: next,
        future: [],
      });
    },
    [apply],
  );
  const undo = useCallback((): TimelineData[] | null => {
    const previous = current.current;
    const next = previous.past.at(-1);
    if (!next) return null;
    apply({
      past: previous.past.slice(0, -1),
      present: next,
      future: [previous.present, ...previous.future],
    });
    return next;
  }, [apply]);
  const redo = useCallback((): TimelineData[] | null => {
    const previous = current.current;
    const next = previous.future[0];
    if (!next) return null;
    apply({
      past: [...previous.past, previous.present].slice(-MAX_HISTORY_SIZE),
      present: next,
      future: previous.future.slice(1),
    });
    return next;
  }, [apply]);
  const clearHistory = useCallback((): void => {
    apply({ past: [], present: current.current.present, future: [] });
  }, [apply]);
  return {
    timeline: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setTimeline,
    undo,
    redo,
    clearHistory,
  };
}
