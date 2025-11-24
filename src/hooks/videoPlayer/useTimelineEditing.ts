import { useCallback } from 'react';
import { ulid } from 'ulid';
import { TimelineData } from '../../types/TimelineData';

export interface TimelineEditingHandlers {
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    qualifier: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
  ) => void;
  deleteTimelineDatas: (idList: string[]) => void;
  updateQualifier: (id: string, qualifier: string) => void;
  updateActionResult: (id: string, actionResult: string) => void;
  updateActionType: (id: string, actionType: string) => void;
  updateTimelineRange: (id: string, startTime: number, endTime: number) => void;
  updateTimelineItem: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  sortTimelineDatas: (column: string, sortDesc: boolean) => void;
}

export const useTimelineEditing = (
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>,
): TimelineEditingHandlers => {
  const addTimelineData = useCallback(
    (
      actionName: string,
      startTime: number,
      endTime: number,
      qualifier: string,
      actionType?: string,
      actionResult?: string,
      labels?: Array<{ name: string; group: string }>,
    ) => {
      // labels配列が渡された場合はそれを使用、なければactionType/actionResultから生成
      const finalLabels: Array<{ name: string; group: string }> = [];
      if (labels && labels.length > 0) {
        finalLabels.push(...labels);
      } else {
        if (actionType) {
          finalLabels.push({ name: actionType, group: 'actionType' });
        }
        if (actionResult) {
          finalLabels.push({ name: actionResult, group: 'actionResult' });
        }
      }

      const newTimelineInstance: TimelineData = {
        id: ulid(),
        actionName,
        startTime,
        endTime,
        qualifier,
        labels: finalLabels.length > 0 ? finalLabels : undefined,
      };
      setTimeline((prev) => [...prev, newTimelineInstance]);
    },
    [setTimeline],
  );

  const deleteTimelineDatas = useCallback(
    (idList: string[]) => {
      setTimeline((prev) => prev.filter((item) => !idList.includes(item.id)));
    },
    [setTimeline],
  );

  const updateQualifier = useCallback(
    (id: string, qualifier: string) => {
      setTimeline((prev) =>
        prev.map((item) => (item.id === id ? { ...item, qualifier } : item)),
      );
    },
    [setTimeline],
  );

  const updateActionResult = useCallback(
    (id: string, actionResult: string) => {
      console.debug('[useTimelineEditing] updateActionResult called:', {
        id,
        actionResult,
      });
      setTimeline((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== id) return item;

          // labels配列を更新（actionResultグループを更新）
          const updatedLabels = item.labels ? [...item.labels] : [];
          const resultIndex = updatedLabels.findIndex(
            (l) => l.group === 'actionResult',
          );

          if (resultIndex >= 0) {
            // 既存のactionResultラベルを更新
            updatedLabels[resultIndex] = {
              name: actionResult,
              group: 'actionResult',
            };
          } else {
            // actionResultラベルが存在しない場合は追加
            updatedLabels.push({ name: actionResult, group: 'actionResult' });
          }

          // actionResultフィールドを除外し、labels配列のみを更新
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { actionResult: _removedActionResult, ...rest } = item;
          return { ...rest, labels: updatedLabels };
        });
        console.debug(
          '[useTimelineEditing] Timeline after updateActionResult:',
          updated.find((item) => item.id === id),
        );
        return updated;
      });
    },
    [setTimeline],
  );

  const updateActionType = useCallback(
    (id: string, actionType: string) => {
      console.debug('[useTimelineEditing] updateActionType called:', {
        id,
        actionType,
      });
      setTimeline((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== id) return item;

          // labels配列を更新（actionTypeグループを更新）
          const updatedLabels = item.labels ? [...item.labels] : [];
          const typeIndex = updatedLabels.findIndex(
            (l) => l.group === 'actionType',
          );

          if (typeIndex >= 0) {
            // 既存のactionTypeラベルを更新
            updatedLabels[typeIndex] = {
              name: actionType,
              group: 'actionType',
            };
          } else {
            // actionTypeラベルが存在しない場合は追加
            updatedLabels.push({ name: actionType, group: 'actionType' });
          }

          // actionTypeフィールドを除外し、labels配列のみを更新
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { actionType: _removedActionType, ...rest } = item;
          return { ...rest, labels: updatedLabels };
        });
        console.debug(
          '[useTimelineEditing] Timeline after updateActionType:',
          updated.find((item) => item.id === id),
        );
        return updated;
      });
    },
    [setTimeline],
  );

  const updateTimelineRange = useCallback(
    (id: string, startTime: number, endTime: number) => {
      const normalizedStart = Number.isFinite(startTime)
        ? Math.max(0, startTime)
        : 0;
      const normalizedEnd = Number.isFinite(endTime)
        ? Math.max(normalizedStart, endTime)
        : normalizedStart;

      setTimeline((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                startTime: normalizedStart,
                endTime: Math.max(normalizedStart, normalizedEnd),
              }
            : item,
        ),
      );
    },
    [setTimeline],
  );

  const updateTimelineItem = useCallback(
    (id: string, updates: Partial<Omit<TimelineData, 'id'>>) => {
      console.debug('[useTimelineEditing] updateTimelineItem called:', {
        id,
        updates,
      });
      setTimeline((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        );
        console.debug(
          '[useTimelineEditing] Timeline after updateTimelineItem:',
          updated.find((item) => item.id === id),
        );
        return updated;
      });
    },
    [setTimeline],
  );

  const sortTimelineDatas = useCallback(
    (column: string, sortDesc: boolean) => {
      setTimeline((prev) => {
        const direction = sortDesc ? -1 : 1;
        const sorted = [...prev].sort((a, b) => {
          if (column === 'startTime') {
            return a.startTime === b.startTime
              ? 0
              : a.startTime > b.startTime
                ? direction
                : -direction;
          }
          if (column === 'endTime') {
            return a.endTime === b.endTime
              ? 0
              : a.endTime > b.endTime
                ? direction
                : -direction;
          }
          if (column === 'actionName') {
            return (
              a.actionName.localeCompare(b.actionName, undefined, {
                sensitivity: 'base',
              }) * direction
            );
          }
          return 0;
        });
        return sorted;
      });
    },
    [setTimeline],
  );

  return {
    addTimelineData,
    deleteTimelineDatas,
    updateQualifier,
    updateActionResult,
    updateActionType,
    updateTimelineRange,
    updateTimelineItem,
    sortTimelineDatas,
  };
};
