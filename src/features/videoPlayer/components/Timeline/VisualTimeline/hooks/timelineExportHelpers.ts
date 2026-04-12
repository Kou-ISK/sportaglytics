import type { TimelineData } from '../../../../../../types/timeline/core';
import type {
  ClipExportItem,
  ClipExportScope,
} from '../../../../../../shared/clipExport/clipExportTypes';

const buildActionIndexLookup = (
  timeline: TimelineData[],
): Map<string, number> => {
  const ordered = [...timeline].sort((a, b) => a.startTime - b.startTime);
  const actionIndexLookup = new Map<string, number>();
  const counters: Record<string, number> = {};

  ordered.forEach((item) => {
    const count = (counters[item.actionName] || 0) + 1;
    counters[item.actionName] = count;
    actionIndexLookup.set(item.id, count);
  });

  return actionIndexLookup;
};

export const resolveExportSourceItems = ({
  timeline,
  selectedIds,
  exportScope,
}: {
  timeline: TimelineData[];
  selectedIds: string[];
  exportScope: ClipExportScope;
}): TimelineData[] => {
  if (exportScope !== 'selected') {
    return timeline;
  }

  return timeline.filter((item) => selectedIds.includes(item.id));
};

export const buildExportClips = ({
  timeline,
  sourceItems,
}: {
  timeline: TimelineData[];
  sourceItems: TimelineData[];
}): ClipExportItem[] => {
  const actionIndexLookup = buildActionIndexLookup(timeline);

  return [...sourceItems]
    .sort((a, b) => a.startTime - b.startTime)
    .map((item) => {
      const count = actionIndexLookup.get(item.id) ?? 1;

      return {
        id: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        labels:
          item.labels?.map((label) => ({
            group: label.group || '',
            name: label.name,
          })) || undefined,
        memo: item.memo || undefined,
        actionIndex: count,
      };
    });
};
