import type { EvidenceFilters, EvidenceItem } from './types';
import type { EvidenceIndex, EvidenceIndexItem } from './evidenceIndex';
import { tokenizeQuery } from './evidenceIndex';

export interface RetrieverOptions {
  topK: number;
  timeRange?: EvidenceFilters['timeRange'];
  labelFilters?: EvidenceFilters['labelFilters'];
}

export interface Retriever {
  retrieve: (
    query: string,
    index: EvidenceIndex,
    options: RetrieverOptions,
  ) => EvidenceItem[];
}

type ScoredEvidence = {
  item: EvidenceIndexItem;
  score: number;
};

const matchesTimeRange = (
  item: EvidenceIndexItem,
  range?: EvidenceFilters['timeRange'],
): boolean => {
  if (!range) return true;
  const start = range.start;
  const end = range.end;
  if (start != null && end != null) {
    return item.endTime >= start && item.startTime <= end;
  }
  if (start != null) {
    return item.endTime >= start;
  }
  if (end != null) {
    return item.startTime <= end;
  }
  return true;
};

const matchesLabelFilters = (
  item: EvidenceIndexItem,
  filters?: EvidenceFilters['labelFilters'],
): boolean => {
  if (!filters || filters.length === 0) return true;
  return filters.every((filter) => {
    if (!filter.group && !filter.name) return true;
    return item.labels.some((label) => {
      const groupMatch =
        !filter.group ||
        (label.group ?? '').toLowerCase() === filter.group.toLowerCase();
      const nameMatch = !filter.name || label.name === filter.name;
      return groupMatch && nameMatch;
    });
  });
};

const parseTimeIntent = (query: string) => {
  const secondsMatch = query.match(/(\d+)\s*秒/);
  const seconds = secondsMatch ? Number(secondsMatch[1]) : null;
  const hasWithin = query.includes('以内') || query.includes('直前') || query.includes('直後');
  const direction = query.includes('直前')
    ? 'before'
    : query.includes('直後')
      ? 'after'
      : 'within';
  if (!hasWithin) return null;
  return { seconds: seconds ?? 30, direction };
};

const timeProximityBonus = (
  item: EvidenceIndexItem,
  range: EvidenceFilters['timeRange'] | undefined,
  query: string,
): number => {
  const intent = parseTimeIntent(query);
  if (!intent || (!range?.start && !range?.end)) return 0;
  const anchor = range?.start ?? range?.end ?? 0;
  const distance =
    intent.direction === 'before'
      ? Math.max(0, anchor - item.endTime)
      : Math.max(0, item.startTime - anchor);
  if (distance > intent.seconds) return 0;
  return 1 + (intent.seconds - distance) / intent.seconds;
};

const scoreItem = (
  item: EvidenceIndexItem,
  queryTokens: Set<string>,
  query: string,
  range?: EvidenceFilters['timeRange'],
): number => {
  if (queryTokens.size === 0) return 0;
  let tokenScore = 0;
  let labelBonus = 0;
  let memoBonus = 0;

  for (const token of queryTokens) {
    if (item.tokenSet.has(token)) tokenScore += 1;
    if (item.labelTokenSet.has(token)) labelBonus += 1;
    if (item.memoTokenSet.has(token)) memoBonus += 1;
  }

  return tokenScore + labelBonus * 2 + memoBonus + timeProximityBonus(item, range, query);
};

const pickRepresentativeIds = (items: EvidenceIndexItem[]): Set<string> => {
  if (items.length === 0) return new Set();
  const durations = items.map((item) => item.duration).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];
  let closestToMedian = items[0];
  for (const item of items) {
    if (Math.abs(item.duration - median) < Math.abs(closestToMedian.duration - median)) {
      closestToMedian = item;
    }
  }

  const shortest = items.reduce((a, b) => (a.duration <= b.duration ? a : b));
  const longest = items.reduce((a, b) => (a.duration >= b.duration ? a : b));

  const labelFrequency = new Map<string, number>();
  for (const item of items) {
    for (const label of item.labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      labelFrequency.set(key, (labelFrequency.get(key) ?? 0) + 1);
    }
  }
  let rareLabelItem: EvidenceIndexItem | null = null;
  let rareScore = Infinity;
  for (const item of items) {
    for (const label of item.labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      const count = labelFrequency.get(key) ?? 0;
      if (count > 0 && count < rareScore) {
        rareScore = count;
        rareLabelItem = item;
      }
    }
  }

  const ids = new Set<string>();
  ids.add(closestToMedian.id);
  ids.add(shortest.id);
  ids.add(longest.id);
  if (rareLabelItem) ids.add(rareLabelItem.id);
  return ids;
};

export class HybridEvidenceRetriever implements Retriever {
  retrieve(query: string, index: EvidenceIndex, options: RetrieverOptions): EvidenceItem[] {
    const queryTokens = tokenizeQuery(query);
    const filtered = index.items.filter(
      (item) =>
        matchesTimeRange(item, options.timeRange) &&
        matchesLabelFilters(item, options.labelFilters),
    );

    let scored = filtered.map((item) => ({
      item,
      score: scoreItem(item, queryTokens, query, options.timeRange),
    }));

    if (queryTokens.size === 0) {
      scored = scored.sort((a, b) => b.item.startTime - a.item.startTime);
    } else {
      scored = scored.sort((a, b) => b.score - a.score);
    }

    const topK = Math.max(1, options.topK);
    const topItems = scored.slice(0, topK).map((entry) => entry.item);
    const repIds = pickRepresentativeIds(topItems);

    const result: EvidenceItem[] = [];
    for (const entry of scored) {
      if (repIds.has(entry.item.id)) {
        result.push(entry.item);
      }
    }
    for (const entry of scored) {
      if (!result.some((item) => item.id === entry.item.id)) {
        result.push(entry.item);
      }
      if (result.length >= topK) break;
    }

    return result.slice(0, topK);
  }
}
