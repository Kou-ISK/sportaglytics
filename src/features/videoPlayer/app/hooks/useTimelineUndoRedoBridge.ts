import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNotification } from '../../../../contexts/NotificationContext';
import type { TimelineData } from '../../../../types/timeline/core';
import { subscribeTimelineUndoRedoMenu } from '../gateways/menuEventGateway';

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
    return subscribeTimelineUndoRedoMenu(handleUndo, handleRedo);
  }, [handleRedo, handleUndo]);

  return {
    handleUndo,
    handleRedo,
  };
};
