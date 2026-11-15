import type { TimelineData } from '../../../../types/timeline/core';
import type { SCLabel } from '../../../../types/timeline/sportscode';

/** Labels shared by every selected item; an unknown selection has no common labels. */
export const getCommonTimelineLabels = (
  timeline: TimelineData[],
  ids: string[],
): SCLabel[] => {
  if (ids.length === 0) return [];
  const selected = ids.map((id) => timeline.find((item) => item.id === id));
  const known = selected.filter((item) => item !== undefined);
  if (known.length !== ids.length) return [];
  const [first, ...rest] = known;
  return (first.labels ?? []).filter((label) =>
    rest.every((item) =>
      (item.labels ?? []).some(
        (entry) => entry.name === label.name && entry.group === label.group,
      ),
    ),
  );
};
