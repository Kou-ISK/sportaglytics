import type { TimelineData } from '../../types/timeline/core';
import {
  resolveInsightState,
  safeInsightDuration,
  type NormalizedInsightTeamInfo,
  uniqueInsightIds,
} from './eventInsightsCommon';
import type {
  InsightDimension,
  InsightEventStat,
  InsightPhaseStat,
} from './eventInsights.types';

interface BuildDurationExtremesParams {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}

interface BuildPhaseDistributionParams {
  ordered: TimelineData[];
  totalEvents: number;
  timeSpanSec: number;
  minStart: number;
  durationSum: number;
}

export const buildDurationExtremes = ({
  ordered,
  dimension,
  topN,
  normalizedTeamInfo,
}: BuildDurationExtremesParams): {
  longestEvents: InsightEventStat[];
  shortestEvents: InsightEventStat[];
} => {
  const events = ordered
    .map(
      (item): InsightEventStat => ({
        id: item.id,
        state: resolveInsightState(item, dimension, normalizedTeamInfo),
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        duration: safeInsightDuration(item),
        evidenceIds: uniqueInsightIds([item.id]),
      }),
    )
    .filter((item) => item.duration > 0);

  return {
    longestEvents: [...events]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, topN),
    shortestEvents: [...events]
      .sort((a, b) => a.duration - b.duration)
      .slice(0, topN),
  };
};

export const buildPhaseDistribution = ({
  ordered,
  totalEvents,
  timeSpanSec,
  minStart,
  durationSum,
}: BuildPhaseDistributionParams): InsightPhaseStat[] | undefined => {
  if (totalEvents === 0 || timeSpanSec <= 0 || !Number.isFinite(minStart)) {
    return undefined;
  }

  const firstCut = minStart + timeSpanSec / 3;
  const secondCut = minStart + (2 * timeSpanSec) / 3;
  const phases: InsightPhaseStat['phase'][] = ['early', 'mid', 'late'];
  const buckets = new Map<
    InsightPhaseStat['phase'],
    { count: number; duration: number; ids: string[] }
  >();

  phases.forEach((phase) => {
    buckets.set(phase, { count: 0, duration: 0, ids: [] });
  });

  for (const item of ordered) {
    const mid = (item.startTime + item.endTime) / 2;
    const phase = mid < firstCut ? 'early' : mid < secondCut ? 'mid' : 'late';
    const bucket = buckets.get(phase);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.duration += safeInsightDuration(item);
    if (bucket.ids.length < 5) {
      bucket.ids.push(item.id);
    }
  }

  const phaseDistribution = phases.map((phase): InsightPhaseStat => {
    const bucket = buckets.get(phase) ?? { count: 0, duration: 0, ids: [] };
    return {
      phase,
      count: bucket.count,
      shareCount: totalEvents > 0 ? bucket.count / totalEvents : 0,
      totalDuration: bucket.duration,
      shareDuration: durationSum > 0 ? bucket.duration / durationSum : 0,
      evidenceIds: uniqueInsightIds(bucket.ids),
    };
  });

  return phaseDistribution.length > 0 ? phaseDistribution : undefined;
};
