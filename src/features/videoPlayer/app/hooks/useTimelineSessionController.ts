import { useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { ulid } from 'ulid';
import type {
  NewTimelineData,
  TimelineData,
  TimelineRow,
} from '../../../../types/timeline/core';
import {
  ensureTimelineRows,
  getDefaultTimelineRowColor,
  moveTimelineRowInList,
  pasteTimelineItemsInRow,
} from '../../shared/timelineRows';
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
  timelineRows: TimelineRow[];
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
  addTimelineDatas: (items: NewTimelineData[]) => string[];
  addTimelineRow: (name?: string, color?: string) => void;
  updateTimelineRow: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  moveTimelineRow: (sourceId: string, targetId: string) => void;
  deleteTimelineRows: (ids: string[]) => void;
  pasteTimelineItemsToRow: (
    items: TimelineData[],
    targetRowId: string,
  ) => string[];
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
  duplicateTimelineItem: (id: string) => string | null;
  sortTimelineDatas: (column: string, sortDesc: boolean) => void;
  performUndo: () => TimelineData[] | null;
  performRedo: () => TimelineData[] | null;
}

export const useTimelineSessionController =
  (): UseTimelineSessionControllerResult => {
    const {
      timeline: persistedTimeline,
      setTimeline: setPersistedTimeline,
      timelineRows,
      setTimelineRows,
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
          typeof value === 'function' ? value(timelineRef.current) : value;
        timelineRef.current = next;
        setTimelineWithHistory(next);
        setPersistedTimeline(next);
      },
      [setPersistedTimeline, setTimelineWithHistory],
    );

    const editing = useTimelineEditing(setTimeline);

    useEffect(() => {
      setTimelineRows((current) => ensureTimelineRows(current, timeline));
    }, [setTimelineRows, timeline]);

    const addTimelineRow = useCallback(
      (requestedName?: string, requestedColor?: string): void => {
        setTimelineRows((current) => {
          const baseName = requestedName?.trim() || '新しい行';
          let name = baseName;
          let suffix = 2;
          const existingNames = new Set(current.map((row) => row.name));
          while (existingNames.has(name)) {
            name = `${baseName} ${suffix}`;
            suffix += 1;
          }
          return [
            ...current,
            {
              id: ulid(),
              name,
              color: requestedColor ?? getDefaultTimelineRowColor(name),
            },
          ];
        });
      },
      [setTimelineRows],
    );

    const updateTimelineRow = useCallback(
      (id: string, updates: Pick<TimelineRow, 'name' | 'color'>): void => {
        const row = timelineRows.find((candidate) => candidate.id === id);
        if (!row) return;
        const name = updates.name.trim();
        if (!name) return;
        const duplicate = timelineRows.some(
          (candidate) => candidate.id !== id && candidate.name === name,
        );
        if (duplicate) return;

        setTimelineRows((current) =>
          current.map((candidate) =>
            candidate.id === id
              ? { ...candidate, name, color: updates.color }
              : candidate,
          ),
        );
        setTimeline((current) =>
          current.map((item) =>
            item.actionName === row.name
              ? { ...item, actionName: name, color: updates.color }
              : item,
          ),
        );
      },
      [setTimeline, setTimelineRows, timelineRows],
    );

    const moveTimelineRow = useCallback(
      (sourceId: string, targetId: string): void => {
        setTimelineRows((current) =>
          moveTimelineRowInList(current, sourceId, targetId),
        );
      },
      [setTimelineRows],
    );

    const deleteTimelineRows = useCallback(
      (ids: string[]): void => {
        if (ids.length === 0) return;
        const deletedNames = new Set(
          timelineRows
            .filter((row) => ids.includes(row.id))
            .map((row) => row.name),
        );
        if (deletedNames.size === 0) return;
        setTimeline((current) =>
          current.filter((item) => !deletedNames.has(item.actionName)),
        );
        setTimelineRows((current) =>
          current.filter((row) => !ids.includes(row.id)),
        );
      },
      [setTimeline, setTimelineRows, timelineRows],
    );

    const pasteTimelineItemsToRow = useCallback(
      (items: TimelineData[], targetRowId: string): string[] => {
        const targetRow = timelineRows.find((row) => row.id === targetRowId);
        if (!targetRow || items.length === 0) return [];
        const pastedIds = items.map(() => ulid());
        setTimeline((current) =>
          pasteTimelineItemsInRow(current, items, targetRow, pastedIds),
        );
        return pastedIds;
      },
      [setTimeline, timelineRows],
    );

    const addTimelineData = useCallback<
      UseTimelineSessionControllerResult['addTimelineData']
    >(
      (...args) => {
        const [
          actionName,
          startTime,
          endTime,
          memo,
          actionType,
          actionResult,
          labels,
          color,
        ] = args;
        const rowColor =
          timelineRows.find((row) => row.name === actionName)?.color ?? color;
        editing.addTimelineData(
          actionName,
          startTime,
          endTime,
          memo,
          actionType,
          actionResult,
          labels,
          rowColor,
        );
      },
      [editing, timelineRows],
    );

    const addTimelineDatas = useCallback(
      (items: NewTimelineData[]): string[] => {
        const resolvedItems = items.map((item) => {
          const rowColor = timelineRows.find(
            (row) => row.name === item.actionName,
          )?.color;
          return {
            ...item,
            color: rowColor ?? item.color,
          };
        });
        return editing.addTimelineDatas(resolvedItems);
      },
      [editing, timelineRows],
    );

    return {
      timeline,
      timelineRows,
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
      addTimelineData,
      addTimelineDatas,
      addTimelineRow,
      updateTimelineRow,
      moveTimelineRow,
      deleteTimelineRows,
      pasteTimelineItemsToRow,
      performUndo,
      performRedo,
    };
  };
