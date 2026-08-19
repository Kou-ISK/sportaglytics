import type {
  TimelineData,
  TimelineRow,
  TimelineRowSortSpec,
} from '../../../types/timeline/core';

export type { TimelineRowSortSpec } from '../../../types/timeline/core';

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

const createInstanceCounts = (
  timeline: TimelineData[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  timeline.forEach((item) => {
    counts.set(item.actionName, (counts.get(item.actionName) ?? 0) + 1);
  });
  return counts;
};

const compareWithStableFallback = (
  primary: number,
  left: TimelineRow,
  right: TimelineRow,
): number => {
  if (primary !== 0) return primary;
  const byName = compareText(left.name, right.name);
  if (byName !== 0) return byName;
  return compareText(left.id, right.id);
};

export const sortTimelineRows = (
  rows: TimelineRow[],
  timeline: TimelineData[],
  spec: TimelineRowSortSpec,
): TimelineRow[] => {
  const currentIndex = new Map(rows.map((row, index) => [row.id, index]));

  if (spec.criterion === 'color') {
    // Hudl documents "sort by color" but not a canonical color-order contract.
    // Group identical colors while preserving the current first-seen color order.
    const colorRank = new Map<string, number>();
    rows.forEach((row) => {
      if (!colorRank.has(row.color)) colorRank.set(row.color, colorRank.size);
    });
    return [...rows].sort((left, right) => {
      const rankDelta =
        (colorRank.get(left.color) ?? 0) - (colorRank.get(right.color) ?? 0);
      if (rankDelta !== 0) return rankDelta;
      return (currentIndex.get(left.id) ?? 0) - (currentIndex.get(right.id) ?? 0);
    });
  }

  const direction = spec.direction === 'desc' ? -1 : 1;
  const counts = createInstanceCounts(timeline);

  return [...rows].sort((left, right) => {
    const primary =
      spec.criterion === 'name'
        ? compareText(left.name, right.name)
        : (counts.get(left.name) ?? 0) - (counts.get(right.name) ?? 0);
    return direction * compareWithStableFallback(primary, left, right);
  });
};
