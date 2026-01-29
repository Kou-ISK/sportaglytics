import type { EvidenceFilters, EvidenceItem } from './types';
import type { EvidenceIndex, EvidenceIndexItem } from './evidenceIndex';
import { tokenizeQuery } from './evidenceIndex';

export type RetrieverWeights = {
  token: number;
  label: number;
  memo: number;
  time: number;
  rareLabel: number;
};

export type RetrieverDiversifyOptions = {
  maxEvidence?: number;
  ensureTop?: number;
  maxRare?: number;
  maxInsight?: number;
};

export interface RetrieverOptions {
  topK: number;
  timeRange?: EvidenceFilters['timeRange'];
  labelFilters?: EvidenceFilters['labelFilters'];
  weights?: Partial<RetrieverWeights>;
  diversify?: RetrieverDiversifyOptions;
  insightEvidenceIds?: string[];
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

const DEFAULT_WEIGHTS: RetrieverWeights = {
  token: 1,
  label: 1.6,
  memo: 1.1,
  time: 1.2,
  rareLabel: 0.6,
};

const DEFAULT_DIVERSIFY: Required<RetrieverDiversifyOptions> = {
  maxEvidence: 24,
  ensureTop: 6,
  maxRare: 4,
  maxInsight: 6,
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

type TimeHint = {
  windowSeconds?: number;
  direction?: 'before' | 'after' | 'within';
  phase?: 'first' | 'second';
};

const parseTimeHint = (query: string): TimeHint | null => {
  const secondsMatch = query.match(/(\d+(?:\.\d+)?)\s*(秒|sec|s)/i);
  const seconds = secondsMatch ? Number(secondsMatch[1]) : null;
  const hasWindow =
    seconds != null ||
    query.includes('以内') ||
    query.includes('直前') ||
    query.includes('直後');
  const direction = query.includes('直前')
    ? 'before'
    : query.includes('直後')
      ? 'after'
      : hasWindow
        ? 'within'
        : undefined;

  const hasFirstHalf = /前半/.test(query);
  const hasSecondHalf = /後半/.test(query);
  const phase =
    hasFirstHalf && !hasSecondHalf
      ? 'first'
      : hasSecondHalf && !hasFirstHalf
        ? 'second'
        : undefined;

  if (!hasWindow && !phase) return null;
  return {
    windowSeconds: hasWindow ? (seconds ?? 30) : undefined,
    direction,
    phase,
  };
};

const timeProximityBonus = (
  item: EvidenceIndexItem,
  range: EvidenceFilters['timeRange'] | undefined,
  hint: TimeHint | null,
  indexRange: EvidenceIndex['timeRange'],
): number => {
  if (!hint) return 0;
  let bonus = 0;

  if (hint.windowSeconds && hint.direction) {
    const anchor = range?.start ?? range?.end;
    if (anchor != null) {
      const distance =
        hint.direction === 'before'
          ? Math.max(0, anchor - item.endTime)
          : hint.direction === 'after'
            ? Math.max(0, item.startTime - anchor)
            : Math.min(
                Math.abs(item.startTime - anchor),
                Math.abs(item.endTime - anchor),
              );
      if (distance <= hint.windowSeconds) {
        bonus += 1 + (hint.windowSeconds - distance) / hint.windowSeconds;
      }
    } else if (hint.direction === 'within') {
      const duration = item.endTime - item.startTime;
      if (duration >= 0 && duration <= hint.windowSeconds) {
        bonus += 1 + (hint.windowSeconds - duration) / hint.windowSeconds;
      }
    }
  }

  if (hint.phase) {
    const span = indexRange.maxEnd - indexRange.minStart;
    if (span > 0) {
      const center = (item.startTime + item.endTime) / 2;
      const pos = (center - indexRange.minStart) / span;
      const phaseBonus =
        hint.phase === 'first'
          ? Math.max(0, 0.5 - pos) / 0.5
          : Math.max(0, pos - 0.5) / 0.5;
      bonus += phaseBonus;
    }
  }

  return bonus;
};

const scoreItem = (
  item: EvidenceIndexItem,
  queryTokens: Set<string>,
  query: string,
  range: EvidenceFilters['timeRange'] | undefined,
  weights: Partial<RetrieverWeights> | undefined,
  index: EvidenceIndex,
): number => {
  const appliedWeights = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  let tokenScore = 0;
  let labelBonus = 0;
  let memoBonus = 0;

  for (const token of queryTokens) {
    if (item.tokenSet.has(token)) tokenScore += 1;
    if (item.labelTokenSet.has(token)) labelBonus += 1;
    if (item.memoTokenSet.has(token)) memoBonus += 1;
  }

  const hint = parseTimeHint(query);
  const timeBonus = timeProximityBonus(item, range, hint, index.timeRange);

  let rareLabelBonus = 0;
  if (index.labelFrequency.size > 0) {
    const threshold = Math.max(1, Math.ceil(index.items.length * 0.05));
    for (const label of item.labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      const count = index.labelFrequency.get(key) ?? 0;
      if (count > 0 && count <= threshold) {
        const rarity = (threshold - count + 1) / threshold;
        rareLabelBonus = Math.max(rareLabelBonus, rarity);
      }
    }
  }

  const base =
    tokenScore * appliedWeights.token +
    labelBonus * appliedWeights.label +
    memoBonus * appliedWeights.memo;

  return base + timeBonus * appliedWeights.time + rareLabelBonus * appliedWeights.rareLabel;
};

const pickDurationExtremes = (items: EvidenceIndexItem[]) => {
  if (items.length === 0) return { shortest: null, longest: null, median: null };
  const durations = items
    .map((item) => item.duration)
    .sort((a, b) => a - b);
  const medianValue = durations[Math.floor(durations.length / 2)];
  let medianItem = items[0];
  let shortest = items[0];
  let longest = items[0];
  for (const item of items) {
    if (item.duration < shortest.duration) shortest = item;
    if (item.duration > longest.duration) longest = item;
    if (Math.abs(item.duration - medianValue) < Math.abs(medianItem.duration - medianValue)) {
      medianItem = item;
    }
  }
  return { shortest, longest, median: medianItem };
};

const selectRareLabelItems = (
  items: EvidenceIndexItem[],
  index: EvidenceIndex,
  scoredMap: Map<string, number>,
  limit: number,
): EvidenceIndexItem[] => {
  if (items.length === 0) return [];
  const threshold = Math.max(1, Math.ceil(index.items.length * 0.05));
  const rare = items.filter((item) =>
    item.labels.some((label) => {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      const count = index.labelFrequency.get(key) ?? 0;
      return count > 0 && count <= threshold;
    }),
  );
  rare.sort((a, b) => (scoredMap.get(b.id) ?? 0) - (scoredMap.get(a.id) ?? 0));
  return rare.slice(0, limit);
};

const computeTargetCount = (
  selectedCount: number,
  requested: number,
): number => {
  const capped = Math.min(Math.max(1, requested), 30);
  return Math.min(Math.max(capped, selectedCount), 30);
};

const diversifyEvidence = (
  scored: ScoredEvidence[],
  index: EvidenceIndex,
  options: RetrieverOptions,
): EvidenceItem[] => {
  const topK = Math.max(1, options.topK);
  const candidates = scored.slice(0, topK).map((entry) => entry.item);
  const scoredMap = new Map(scored.map((entry) => [entry.item.id, entry.score]));
  const diversifyConfig = { ...DEFAULT_DIVERSIFY, ...(options.diversify ?? {}) };

  const selected: EvidenceIndexItem[] = [];
  const selectedIds = new Set<string>();
  const addItem = (item?: EvidenceIndexItem | null) => {
    if (!item || selectedIds.has(item.id)) return;
    selectedIds.add(item.id);
    selected.push(item);
  };

  const ensureTop = Math.min(diversifyConfig.ensureTop, candidates.length);
  candidates.slice(0, ensureTop).forEach((item) => addItem(item));

  const { shortest, longest, median } = pickDurationExtremes(candidates);
  addItem(median);
  addItem(shortest);
  addItem(longest);

  selectRareLabelItems(candidates, index, scoredMap, diversifyConfig.maxRare).forEach(
    (item) => addItem(item),
  );

  if (options.insightEvidenceIds?.length) {
    let added = 0;
    for (const id of options.insightEvidenceIds) {
      const item = index.byId.get(id);
      if (item) {
        addItem(item);
        added += 1;
      }
      if (added >= diversifyConfig.maxInsight) break;
    }
  }

  const target = computeTargetCount(
    selected.length,
    diversifyConfig.maxEvidence,
  );

  for (const item of candidates) {
    if (selected.length >= target) break;
    addItem(item);
  }

  return selected.slice(0, target);
};

export class HybridEvidenceRetriever implements Retriever {
  retrieve(query: string, index: EvidenceIndex, options: RetrieverOptions): EvidenceItem[] {
    // Stage 2: retrieve candidates (stage 1 is buildEvidenceIndex).
    const queryTokens = tokenizeQuery(query);
    const filtered = index.items.filter(
      (item) =>
        matchesTimeRange(item, options.timeRange) &&
        matchesLabelFilters(item, options.labelFilters),
    );

    let scored = filtered.map((item) => ({
      item,
      score: scoreItem(
        item,
        queryTokens,
        query,
        options.timeRange,
        options.weights,
        index,
      ),
    }));

    const hasSignal = scored.some((entry) => entry.score > 0);
    scored = scored.sort((a, b) => {
      if (!hasSignal) {
        return b.item.startTime - a.item.startTime;
      }
      if (b.score !== a.score) return b.score - a.score;
      return b.item.startTime - a.item.startTime;
    });

    // Stage 3: diversify representative evidence for LLM input.
    return diversifyEvidence(scored, index, options);
  }
}
