import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNotification } from '../../../../contexts/NotificationContext';
import type { TimelineData } from '../../../../types/TimelineData';

interface UseTimelineUndoRedoBridgeParams {
  performUndo: () => TimelineData[] | null;
  performRedo: () => TimelineData[] | null;
  setPersistedTimeline: Dispatch<SetStateAction<TimelineData[]>>;
}

interface UseTimelineUndoRedoBridgeResult {
  handleUndo: () => void;
  handleRedo: () => void;
}

export const useTimelineUndoRedoBridge = ({
  performUndo,
  performRedo,
  setPersistedTimeline,
}: UseTimelineUndoRedoBridgeParams): UseTimelineUndoRedoBridgeResult => {
  const { info } = useNotification();

  const handleUndo = useCallback((): void => {
    const previousTimeline = performUndo();
    if (!previousTimeline) {
      return;
    }

    setPersistedTimeline(previousTimeline);
    info('元に戻しました');
  }, [info, performUndo, setPersistedTimeline]);

  const handleRedo = useCallback((): void => {
    const nextTimeline = performRedo();
    if (!nextTimeline) {
      return;
    }

    setPersistedTimeline(nextTimeline);
    info('やり直しました');
  }, [info, performRedo, setPersistedTimeline]);

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onTimelineUndo || !api?.onTimelineRedo) {
      return;
    }

    const unsubscribeUndo = api.onTimelineUndo(handleUndo);
    const unsubscribeRedo = api.onTimelineRedo(handleRedo);

    return () => {
      unsubscribeUndo();
      unsubscribeRedo();
    };
  }, [handleRedo, handleUndo]);

  return {
    handleUndo,
    handleRedo,
  };
};
