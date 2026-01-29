import type { TimelineData } from '../../../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../../../utils/labelExtractors';
import type { EvidenceFilters } from '../ai/types';

export type InsightDimension =
  | { type: 'action' }
  | { type: 'labelGroup'; group: string };

export type InsightStateStat = {
  state: string;
  count: number;
  share: number;
  totalDuration: number;
  avgDuration: number;
  evidenceIds: string[];
};

export type InsightTransitionStat = {
  from: string;
  to: string;
  count: number;
  probability: number;
  avgGap: number;
  evidenceIds: string[];
};

export type InsightSequenceStat = {
  sequence: string[];
  count: number;
  evidenceIds: string[];
};

export type InsightStreakStat = {
  state: string;
  length: number;
  startId: string;
  endId: string;
  evidenceIds: string[];
};

export type InsightEventStat = {
  id: string;
  state: string;
  actionName: string;
  startTime: number;
  endTime: number;
  duration: number;
  evidenceIds: string[];
};

export type EventInsights = {
  summary: {
    totalEvents: number;
    uniqueStates: number;
    timeSpanSec: number;
    eventsPerMin: number;
    avgDuration: number;
  };
  topStates: InsightStateStat[];
  topTransitions: InsightTransitionStat[];
  topSequences: InsightSequenceStat[];
  streaks: InsightStreakStat[];
  rareStates: InsightStateStat[];
  longestEvents: InsightEventStat[];
};

const toLower = (value?: string | null) => (value ?? '').toLowerCase();

const resolveState = (item: TimelineData, dimension: InsightDimension): string => {
  if (dimension.type === 'action') {
    return item.actionName?.trim() || '未設定';
  }
  const labels = getLabelsFromTimelineData(item);
  const target = labels.find(
    (label) => toLower(label.group) === toLower(dimension.group),
  );
  return target?.name?.trim() || '未設定';
};

const matchesTimeRange = (
  item: TimelineData,
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
  item: TimelineData,
  filters?: EvidenceFilters['labelFilters'],
): boolean => {
  if (!filters || filters.length === 0) return true;
  const labels = getLabelsFromTimelineData(item);
  return filters.every((filter) => {
    if (!filter.group && !filter.name) return true;
    return labels.some((label) => {
      const groupMatch =
        !filter.group || toLower(label.group) === toLower(filter.group);
      const nameMatch =
        !filter.name || toLower(label.name) === toLower(filter.name);
      return groupMatch && nameMatch;
    });
  });
};

export const filterTimelineByEvidenceFilters = (
  timeline: TimelineData[],
  filters?: EvidenceFilters,
): TimelineData[] => {
  if (!filters) return timeline;
  return timeline.filter(
    (item) =>
      matchesTimeRange(item, filters.timeRange) &&
      matchesLabelFilters(item, filters.labelFilters),
  );
};

const sortTimeline = (timeline: TimelineData[]): TimelineData[] => {
  return [...timeline].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.endTime - b.endTime;
  });
};

const safeDuration = (item: TimelineData) =>
  Math.max(0, item.endTime - item.startTime);

const uniqueIds = (ids: string[], limit = 5) => {
  const result: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= limit) break;
  }
  return result;
};

export const buildEventInsights = (
  timeline: TimelineData[],
  config: {
    dimension: InsightDimension;
    topN?: number;
    sequenceLength?: number;
  },
): EventInsights => {
  const topN = Math.max(1, config.topN ?? 5);
  const sequenceLength = Math.max(2, config.sequenceLength ?? 3);
  const ordered = sortTimeline(timeline);
  const totalEvents = ordered.length;
  const stateSamples = new Map<string, string[]>();
  const transitionSamples = new Map<string, string[][]>();
  const sequenceSamples = new Map<string, string[][]>();

  const stateTotals = new Map<
    string,
    { count: number; duration: number }
  >();
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  let durationSum = 0;

  for (const item of ordered) {
    const state = resolveState(item, config.dimension);
    const duration = safeDuration(item);
    durationSum += duration;
    const samples = stateSamples.get(state) ?? [];
    if (samples.length < 5) {
      samples.push(item.id);
      stateSamples.set(state, samples);
    }
    const existing = stateTotals.get(state) ?? { count: 0, duration: 0 };
    existing.count += 1;
    existing.duration += duration;
    stateTotals.set(state, existing);
    minStart = Math.min(minStart, item.startTime);
    maxEnd = Math.max(maxEnd, item.endTime);
  }

  const timeSpanSec =
    totalEvents === 0 || !Number.isFinite(minStart) || !Number.isFinite(maxEnd)
      ? 0
      : Math.max(0, maxEnd - minStart);
  const eventsPerMin =
    timeSpanSec > 0 ? totalEvents / (timeSpanSec / 60) : 0;

  const stateStats: InsightStateStat[] = Array.from(stateTotals.entries()).map(
    ([state, value]) => ({
      state,
      count: value.count,
      share: totalEvents > 0 ? value.count / totalEvents : 0,
      totalDuration: value.duration,
      avgDuration: value.count > 0 ? value.duration / value.count : 0,
      evidenceIds: uniqueIds(stateSamples.get(state) ?? []),
    }),
  );

  stateStats.sort((a, b) => b.count - a.count || b.totalDuration - a.totalDuration);
  const topStates = stateStats.slice(0, topN);

  const outgoingCounts = new Map<string, number>();
  const transitionAgg = new Map<string, { count: number; gapSum: number }>();
  const stateSequence = ordered.map((item) => resolveState(item, config.dimension));

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = stateSequence[i];
    const to = stateSequence[i + 1];
    const key = `${from}→${to}`;
    const gap = ordered[i + 1].startTime - ordered[i].endTime;
    const existing = transitionAgg.get(key) ?? { count: 0, gapSum: 0 };
    existing.count += 1;
    existing.gapSum += gap;
    transitionAgg.set(key, existing);
    outgoingCounts.set(from, (outgoingCounts.get(from) ?? 0) + 1);
    const transitionSample = transitionSamples.get(key) ?? [];
    if (transitionSample.length < 3) {
      transitionSample.push([ordered[i].id, ordered[i + 1].id]);
      transitionSamples.set(key, transitionSample);
    }
  }

  const transitionStats: InsightTransitionStat[] = Array.from(
    transitionAgg.entries(),
  ).map(([key, value]) => {
    const [from, to] = key.split('→');
    const totalFrom = outgoingCounts.get(from) ?? value.count;
    const samples = transitionSamples.get(key) ?? [];
    const evidenceIds = uniqueIds(samples.flat());
    return {
      from,
      to,
      count: value.count,
      probability: totalFrom > 0 ? value.count / totalFrom : 0,
      avgGap: value.count > 0 ? value.gapSum / value.count : 0,
      evidenceIds,
    };
  });

  transitionStats.sort(
    (a, b) => b.count - a.count || b.probability - a.probability,
  );
  const topTransitions = transitionStats.slice(0, topN);

  const sequenceAgg = new Map<string, { count: number; seq: string[] }>();
  for (let i = 0; i <= stateSequence.length - sequenceLength; i += 1) {
    const seq = stateSequence.slice(i, i + sequenceLength);
    const key = seq.join('→');
    const existing = sequenceAgg.get(key) ?? { count: 0, seq };
    existing.count += 1;
    sequenceAgg.set(key, existing);
    const samples = sequenceSamples.get(key) ?? [];
    if (samples.length < 2) {
      const ids = ordered.slice(i, i + sequenceLength).map((item) => item.id);
      samples.push(ids);
      sequenceSamples.set(key, samples);
    }
  }
  const sequenceStats: InsightSequenceStat[] = Array.from(sequenceAgg.values())
    .map((entry) => {
      const key = entry.seq.join('→');
      const samples = sequenceSamples.get(key) ?? [];
      const evidenceIds = uniqueIds(samples.flat());
      return { sequence: entry.seq, count: entry.count, evidenceIds };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  const streaks: InsightStreakStat[] = [];
  let currentState = '';
  let currentStart = 0;
  let currentLength = 0;
  for (let i = 0; i < stateSequence.length; i += 1) {
    const state = stateSequence[i];
    if (state === currentState) {
      currentLength += 1;
    } else {
      if (currentLength > 0) {
        streaks.push({
          state: currentState,
          length: currentLength,
          startId: ordered[currentStart]?.id ?? '',
          endId: ordered[i - 1]?.id ?? '',
          evidenceIds: uniqueIds([
            ordered[currentStart]?.id ?? '',
            ordered[i - 1]?.id ?? '',
          ]),
        });
      }
      currentState = state;
      currentStart = i;
      currentLength = 1;
    }
  }
  if (currentLength > 0) {
    streaks.push({
      state: currentState,
      length: currentLength,
      startId: ordered[currentStart]?.id ?? '',
      endId: ordered[ordered.length - 1]?.id ?? '',
      evidenceIds: uniqueIds([
        ordered[currentStart]?.id ?? '',
        ordered[ordered.length - 1]?.id ?? '',
      ]),
    });
  }

  streaks.sort((a, b) => b.length - a.length);

  const rarityThreshold = Math.max(1, Math.ceil(totalEvents * 0.05));
  const rareStates = stateStats
    .filter((stat) => stat.count <= rarityThreshold)
    .sort((a, b) => a.count - b.count)
    .slice(0, topN);

  const longestEvents = ordered
    .map((item) => ({
      id: item.id,
      state: resolveState(item, config.dimension),
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: safeDuration(item),
      evidenceIds: uniqueIds([item.id]),
    }))
    .filter((item) => item.duration > 0)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, topN);

  return {
    summary: {
      totalEvents,
      uniqueStates: stateStats.length,
      timeSpanSec,
      eventsPerMin,
      avgDuration: totalEvents > 0 ? durationSum / totalEvents : 0,
    },
    topStates,
    topTransitions,
    topSequences: sequenceStats,
    streaks: streaks.slice(0, topN),
    rareStates,
    longestEvents,
  };
};
