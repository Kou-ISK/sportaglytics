import type { TimelineData } from '../../../../types/timeline/core';
import type { SCLabel } from '../../../../types/timeline/sportscode';

export const buildSelectionLabelUpdates = (
  timeline: TimelineData[],
  ids: string[],
  labels: SCLabel[],
): Array<{ id: string; labels: SCLabel[] }> => {
  if (ids.length === 0 || labels.length === 0) {
    return [];
  }

  return ids.map((id) => {
    const current = timeline.find((entry) => entry.id === id)?.labels ?? [];
    const merged = [...current];

    for (const label of labels) {
      const exists = merged.some(
        (existing) =>
          existing.group === label.group && existing.name === label.name,
      );
      if (!exists) {
        merged.push(label);
      }
    }

    return { id, labels: merged };
  });
};
