import { useCallback, useEffect, useRef, useState } from 'react';
import { TimelineData } from '../../types/TimelineData';

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
): UseTimelineHistoryReturn {
  const [state, setState] = useState<TimelineHistoryState>({
    past: [],
    present: initialTimeline,
    future: [],
  });

  // 初回マウントフラグ（ファイル読み込み時のみ履歴をリセット）
  const isInitialMount = useRef(true);
  // 前回のinitialTimelineを保持（無限ループを防ぐため）
  const prevInitialTimelineJSON = useRef<string>(
    JSON.stringify(initialTimeline),
  );

  // 外部からのタイムライン更新を検知（ファイル読み込み時など）
  // 注意: 内部でsetTimelineを呼んだ結果の変更では履歴をクリアしない
  useEffect(() => {
    const newJSON = JSON.stringify(initialTimeline);

    // initialTimelineが変更された場合
    if (prevInitialTimelineJSON.current !== newJSON) {
      // 初回マウント時、または現在のpresentと異なる場合のみ履歴をリセット
      // （内部でsetTimelineした結果の同期では履歴をクリアしない）
      const currentPresentJSON = JSON.stringify(state.present);
      if (isInitialMount.current || newJSON !== currentPresentJSON) {
        setState({
          past: [],
          present: initialTimeline,
          future: [],
        });
      }
      prevInitialTimelineJSON.current = newJSON;
      isInitialMount.current = false;
    }
  }, [initialTimeline, state.present]);

  const setTimeline = useCallback((newTimeline: TimelineData[]) => {
    setState((prev) => {
      const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY_SIZE);
      return {
        past: newPast,
        present: newTimeline,
        future: [], // 新しい変更を加えたらfutureはクリア
      };
    });
  }, []);

  const undo = useCallback((): TimelineData[] | null => {
    let result: TimelineData[] | null = null;

    setState((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }

      const previous = prev.past.at(-1);
      if (!previous) return prev;

      const newPast = prev.past.slice(0, -1);

      result = previous;

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });

    return result;
  }, []);

  const redo = useCallback((): TimelineData[] | null => {
    let result: TimelineData[] | null = null;

    setState((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      result = next;

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });

    return result;
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, []);

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
