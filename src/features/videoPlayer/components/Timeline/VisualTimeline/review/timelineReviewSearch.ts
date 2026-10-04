import type { TimelineData } from '../../../../../../types/timeline/core';

const normalize = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase().trim();

/** All terms must match. Search is a view over the document, never a mutation. */
export const searchTimeline = (
  timeline: TimelineData[],
  query: string,
): TimelineData[] => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return timeline
    .filter((item) => {
      const text = normalize(
        [
          item.actionName,
          item.memo,
          ...(item.labels ?? []).flatMap((label) => [label.group, label.name]),
        ].join(' '),
      );
      return terms.every((term) => text.includes(term));
    })
    .sort((left, right) => left.startTime - right.startTime);
};
