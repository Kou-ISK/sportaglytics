import { useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { TimelineData } from '../../../../types/TimelineData';
import { useTimelineEditing } from './useTimelineEditing';
import { useTimelineHistory } from './useTimelineHistory';
import { useTimelinePersistence } from './useTimelinePersistence';
import { useTimelineSelection } from './useTimelineSelection';

type TimelineSelectionHandler = (
  event: ChangeEvent<HTMLInputElement>,
  id: string,
) => void;

interface UseTimelineSessionControllerResult {
  timeline: TimelineData[];
  setTimeline: Dispatch<SetStateAction<TimelineData[]>>;
  canUndo: boolean;
  canRedo: boolean;
  timelineFilePath: string;
  setTimelineFilePath: Dispatch<SetStateAction<string>>;
  setPersistedTimeline: Dispatch<SetStateAction<TimelineData[]>>;
  selectedTimelineIdList: string[];
  setSelectedTimelineIdList: Dispatch<SetStateAction<string[]>>;
  getSelectedTimelineId: TimelineSelectionHandler;
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  deleteTimelineDatas: (idList: string[]) => void;
  updateMemo: (id: string, memo: string) => void;
  updateTimelineRange: (id: string, startTime: number, endTime: number) => void;
  updateTimelineItem: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  sortTimelineDatas: (column: string, sortDesc: boolean) => void;
  performUndo: () => TimelineData[] | null;
  performRedo: () => TimelineData[] | null;
}

export const useTimelineSessionController =
  (): UseTimelineSessionControllerResult => {
    const {
      timeline: persistedTimeline,
      setTimeline: setPersistedTimeline,
      timelineFilePath,
      setTimelineFilePath,
    } = useTimelinePersistence();
    const {
      timeline,
      canUndo,
      canRedo,
      setTimeline: setTimelineWithHistory,
      undo: performUndo,
      redo: performRedo,
    } = useTimelineHistory(persistedTimeline);
    const {
      selectedTimelineIdList,
      setSelectedTimelineIdList,
      getSelectedTimelineId,
    } = useTimelineSelection();

    const timelineRef = useRef<TimelineData[]>(timeline);

    useEffect(() => {
      timelineRef.current = timeline;
    }, [timeline]);

    const setTimeline = useCallback<Dispatch<SetStateAction<TimelineData[]>>>(
      (value) => {
        const next =
          typeof value === 'function'
            ? value(timelineRef.current)
            : value;
        timelineRef.current = next;
        setTimelineWithHistory(next);
        setPersistedTimeline(next);
      },
      [setPersistedTimeline, setTimelineWithHistory],
    );

    const editing = useTimelineEditing(setTimeline);

    return {
      timeline,
      setTimeline,
      canUndo,
      canRedo,
      timelineFilePath,
      setTimelineFilePath,
      setPersistedTimeline,
      selectedTimelineIdList,
      setSelectedTimelineIdList,
      getSelectedTimelineId,
      ...editing,
      performUndo,
      performRedo,
    };
  };
