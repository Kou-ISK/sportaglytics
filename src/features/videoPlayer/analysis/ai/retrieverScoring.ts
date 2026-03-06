import type { EvidenceFilters } from './types';
import type { EvidenceIndex, EvidenceIndexItem } from './evidenceIndex';
import type { TeamContext } from './retrieverTeamContext';
import type { RetrieverWeights } from './retriever';

const DEFAULT_WEIGHTS: RetrieverWeights = {
  token: 1,
  label: 1.6,
  memo: 1.1,
  time: 1.2,
  rareLabel: 0.6,
};

type TimeHint = {
  windowSeconds?: number;
  direction?: 'before' | 'after' | 'within';
  phase?: 'first' | 'second';
};

export const matchesEvidenceTimeRange = (
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

export const matchesEvidenceLabelFilters = (
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

export const scoreEvidenceItem = (
  item: EvidenceIndexItem,
  queryTokens: Set<string>,
  query: string,
  range: EvidenceFilters['timeRange'] | undefined,
  weights: Partial<RetrieverWeights> | undefined,
  index: EvidenceIndex,
  teamContext?: TeamContext | null,
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

  let teamBonus = 0;
  if (teamContext?.hasTeamIntent && teamContext.assignments.size > 0) {
    const team = teamContext.assignments.get(item.id);
    if (team && teamContext.mentionedTeam && team === teamContext.mentionedTeam) {
      teamBonus += 1.4;
    } else if (team && !teamContext.mentionedTeam) {
      teamBonus += 0.4;
    }
  }

  return (
    base +
    timeBonus * appliedWeights.time +
    rareLabelBonus * appliedWeights.rareLabel +
    teamBonus
  );
};
