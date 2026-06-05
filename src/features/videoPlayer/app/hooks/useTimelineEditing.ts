import { useCallback } from 'react';
import { ulid } from 'ulid';
import type { TimelineData } from '../../../../types/timeline/core';
import { migrateLegacyTimelineLabels } from '../../../../utils/timelineLabelMigration';

interface TimelineEditingHandlers {
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
  duplicateTimelineItem: (id: string) => string | null;
  sortTimelineDatas: (column: string, sortDesc: boolean) => void;
}

export const duplicateTimelineItemInList = (
  timeline: TimelineData[],
  itemId: string,
  duplicateId: string,
): TimelineData[] => {
  const sourceIndex = timeline.findIndex((item) => item.id === itemId);
  if (sourceIndex === -1) return timeline;

  const source = timeline[sourceIndex];
  const duplicate: TimelineData = {
    ...source,
    id: duplicateId,
    labels: source.labels?.map((label) => ({ ...label })),
  };

  return [
    ...timeline.slice(0, sourceIndex + 1),
    duplicate,
    ...timeline.slice(sourceIndex + 1),
  ];
};

export const useTimelineEditing = (
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>,
): TimelineEditingHandlers => {
  const addTimelineData = useCallback(
    (
      actionName: string,
      startTime: number,
      endTime: number,
      memo: string,
      actionType?: string,
      actionResult?: string,
      labels?: Array<{ name: string; group: string }>,
      color?: string,
    ) => {
      // labels配列が渡された場合はそれを使用、なければ旧引数を現行ラベルへ移行する
      const finalLabels: Array<{ name: string; group: string }> = [];
      if (labels && labels.length > 0) {
        finalLabels.push(
          ...migrateLegacyTimelineLabels(labels).filter(
            (label): label is { name: string; group: string } =>
              typeof label.group === 'string',
          ),
        );
      } else {
        if (actionType) {
          finalLabels.push({ name: actionType, group: 'Type' });
        }
        if (actionResult) {
          finalLabels.push({ name: actionResult, group: 'Result' });
        }
      }

      setTimeline((prev) => {
        // 同じアクション名の既存アイテムがあれば、その色を引き継ぐ（行単位の色管理）
        const existingItem = prev.find(
          (item) => item.actionName === actionName,
        );
        const finalColor = existingItem?.color ?? color;

        const newTimelineInstance: TimelineData = {
          id: ulid(),
          actionName,
          startTime,
          endTime,
          memo,
          labels: finalLabels.length > 0 ? finalLabels : undefined,
          color: finalColor,
        };
        return [...prev, newTimelineInstance];
      });
    },
    [setTimeline],
  );

  const deleteTimelineDatas = useCallback(
    (idList: string[]) => {
      setTimeline((prev) => prev.filter((item) => !idList.includes(item.id)));
    },
    [setTimeline],
  );

  const updateMemo = useCallback(
    (id: string, memo: string) => {
      setTimeline((prev) =>
        prev.map((item) => (item.id === id ? { ...item, memo } : item)),
      );
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
      setTimeline((prev) => {
        return prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        );
      });
    },
    [setTimeline],
  );

  const bulkUpdateTimelineItems = useCallback(
    (ids: string[], updates: Partial<Omit<TimelineData, 'id'>>) => {
      setTimeline((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, ...updates } : item,
        ),
      );
    },
    [setTimeline],
  );

  const duplicateTimelineItem = useCallback(
    (id: string): string | null => {
      const duplicateId = ulid();
      let duplicated = false;

      setTimeline((prev) => {
        const next = duplicateTimelineItemInList(prev, id, duplicateId);
        duplicated = next !== prev;
        return next;
      });

      return duplicated ? duplicateId : null;
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
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    duplicateTimelineItem,
    sortTimelineDatas,
  };
};
