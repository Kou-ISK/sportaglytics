import type { TimelineData } from '../../types/TimelineData';
import {
  resolveInsightState,
  safeInsightDuration,
  type NormalizedInsightTeamInfo,
  uniqueInsightIds,
} from './eventInsightsCommon';
import type {
  EventInsights,
  InsightDimension,
  InsightStateStat,
} from './eventInsights.types';

export interface StateStatsResult {
  summary: EventInsights['summary'];
  topStates: InsightStateStat[];
  topStatesByDuration: InsightStateStat[];
  rareStates: InsightStateStat[];
  stateSequence: string[];
  durationSum: number;
  minStart: number;
  maxEnd: number;
}

interface BuildStateStatsParams {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}

export const buildStateStats = ({
  ordered,
  dimension,
  topN,
  normalizedTeamInfo,
}: BuildStateStatsParams): StateStatsResult => {
  const totalEvents = ordered.length;
  const stateSamples = new Map<string, string[]>();
  const stateTotals = new Map<string, { count: number; duration: number }>();
  const stateSequence: string[] = [];
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  let durationSum = 0;

  for (const item of ordered) {
    const state = resolveInsightState(item, dimension, normalizedTeamInfo);
    stateSequence.push(state);
    const duration = safeInsightDuration(item);
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

  const stateStats = Array.from(stateTotals.entries()).map(
    ([state, value]): InsightStateStat => ({
      state,
      count: value.count,
      share: totalEvents > 0 ? value.count / totalEvents : 0,
      totalDuration: value.duration,
      avgDuration: value.count > 0 ? value.duration / value.count : 0,
      durationShare: durationSum > 0 ? value.duration / durationSum : 0,
      evidenceIds: uniqueInsightIds(stateSamples.get(state) ?? []),
    }),
  );

  stateStats.sort(
    (a, b) => b.count - a.count || b.totalDuration - a.totalDuration,
  );

  const rarityThreshold = Math.max(1, Math.ceil(totalEvents * 0.05));

  return {
    summary: {
      totalEvents,
      uniqueStates: stateStats.length,
      timeSpanSec,
      eventsPerMin: timeSpanSec > 0 ? totalEvents / (timeSpanSec / 60) : 0,
      avgDuration: totalEvents > 0 ? durationSum / totalEvents : 0,
    },
    topStates: stateStats.slice(0, topN),
    topStatesByDuration: [...stateStats]
      .sort((a, b) => b.totalDuration - a.totalDuration || b.count - a.count)
      .slice(0, topN),
    rareStates: stateStats
      .filter((stat) => stat.count <= rarityThreshold)
      .sort((a, b) => a.count - b.count)
      .slice(0, topN),
    stateSequence,
    durationSum,
    minStart,
    maxEnd,
  };
};
