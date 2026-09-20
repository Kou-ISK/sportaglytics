import type { TimelineData } from '../../../types/timeline/core';

export const canSplitTimelineItem = (
  item: TimelineData | undefined,
  time: number,
): boolean =>
  Boolean(
    item &&
    Number.isFinite(time) &&
    Number.isFinite(item.startTime) &&
    Number.isFinite(item.endTime) &&
    item.startTime >= 0 &&
    time > item.startTime &&
    time < item.endTime,
  );

export const getMergeableTimelineItems = (
  timeline: TimelineData[],
  ids: string[],
): TimelineData[] => {
  const selected = new Set(ids);
  const items = timeline.filter((item) => selected.has(item.id));
  if (
    items.length < 2 ||
    items.length !== selected.size ||
    items.some(
      (item) =>
        item.actionName !== items[0].actionName ||
        !Number.isFinite(item.startTime) ||
        !Number.isFinite(item.endTime) ||
        item.startTime < 0 ||
        item.endTime <= item.startTime,
    )
  )
    return [];
  // Equal starts retain document order, independently of selection order.
  return items.sort((a, b) => a.startTime - b.startTime);
};

export const splitTimelineItem = (
  timeline: TimelineData[],
  id: string,
  time: number,
  rightId: string,
): TimelineData[] => {
  const item = timeline.find((entry) => entry.id === id);
  if (
    !item ||
    !canSplitTimelineItem(item, time) ||
    !rightId ||
    timeline.some((entry) => entry.id === rightId)
  )
    return timeline;
  return timeline.flatMap((entry) =>
    entry.id === id
      ? [
          { ...entry, endTime: time },
          {
            ...entry,
            id: rightId,
            startTime: time,
            labels: entry.labels?.map((label) => ({ ...label })),
          },
        ]
      : [entry],
  );
};

export const mergeTimelineItems = (
  timeline: TimelineData[],
  ids: string[],
): TimelineData[] => {
  const items = getMergeableTimelineItems(timeline, ids);
  if (items.length === 0) return timeline;
  const first = items[0];
  const selected = new Set(ids);
  const labels = items
    .flatMap((item) => item.labels ?? [])
    .filter(
      (label, index, all) =>
        all.findIndex(
          (other) => other.name === label.name && other.group === label.group,
        ) === index,
    )
    .map((label) => ({ ...label }));
  const combined: TimelineData = {
    ...first,
    endTime: items.reduce(
      (end, item) => Math.max(end, item.endTime),
      first.endTime,
    ),
    memo: [
      ...new Set(items.map((item) => item.memo).filter((memo) => memo.trim())),
    ].join('\n\n'),
    labels: labels.length > 0 ? labels : undefined,
  };
  return timeline.flatMap((item) =>
    item.id === first.id ? [combined] : selected.has(item.id) ? [] : [item],
  );
};
