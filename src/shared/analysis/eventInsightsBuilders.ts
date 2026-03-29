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
  InsightEventStat,
  InsightPhaseStat,
  InsightSequenceStat,
  InsightStateStat,
  InsightStreakStat,
  InsightTransitionStat,
} from './eventInsights.types';

interface BuildEventInsightsResultParams {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  sequenceLength: number;
  sequenceLengths: number[];
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}

interface StateStatsResult {
  summary: EventInsights['summary'];
  topStates: InsightStateStat[];
  topStatesByDuration: InsightStateStat[];
  rareStates: InsightStateStat[];
  stateSequence: string[];
  durationSum: number;
  minStart: number;
  maxEnd: number;
}

const buildStateStats = ({
  ordered,
  dimension,
  topN,
  normalizedTeamInfo,
}: {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}): StateStatsResult => {
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

  stateStats.sort((a, b) => b.count - a.count || b.totalDuration - a.totalDuration);

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

const buildTransitionStats = ({
  ordered,
  stateSequence,
  topN,
}: {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
}): {
  topTransitions: InsightTransitionStat[];
  strongTransitions?: InsightTransitionStat[];
} => {
  const outgoingCounts = new Map<string, number>();
  const transitionAgg = new Map<string, { count: number; gapSum: number }>();
  const transitionSamples = new Map<string, string[][]>();

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

    const samples = transitionSamples.get(key) ?? [];
    if (samples.length < 3) {
      samples.push([ordered[i].id, ordered[i + 1].id]);
      transitionSamples.set(key, samples);
    }
  }

  const transitionStats = Array.from(transitionAgg.entries()).map(
    ([key, value]): InsightTransitionStat => {
      const [from = '', to = ''] = key.split('→');
      const totalFrom = outgoingCounts.get(from) ?? value.count;
      const samples = transitionSamples.get(key) ?? [];
      return {
        from,
        to,
        count: value.count,
        probability: totalFrom > 0 ? value.count / totalFrom : 0,
        avgGap: value.count > 0 ? value.gapSum / value.count : 0,
        evidenceIds: uniqueInsightIds(samples.flat()),
      };
    },
  );

  transitionStats.sort((a, b) => b.count - a.count || b.probability - a.probability);

  const strongTransitions = transitionStats
    .filter((stat) => stat.count >= 2)
    .sort((a, b) => b.probability - a.probability || b.count - a.count)
    .slice(0, topN);

  return {
    topTransitions: transitionStats.slice(0, topN),
    strongTransitions: strongTransitions.length > 0 ? strongTransitions : undefined,
  };
};

const buildTopSequencesByLength = ({
  ordered,
  stateSequence,
  topN,
  sequenceLengths,
}: {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
  sequenceLengths: number[];
}): Record<number, InsightSequenceStat[]> => {
  const result: Record<number, InsightSequenceStat[]> = {};

  for (const len of sequenceLengths) {
    const sequenceAgg = new Map<string, { count: number; seq: string[] }>();
    const sequenceSamples = new Map<string, string[][]>();

    for (let i = 0; i <= stateSequence.length - len; i += 1) {
      const seq = stateSequence.slice(i, i + len);
      const key = seq.join('→');
      const existing = sequenceAgg.get(key) ?? { count: 0, seq };
      existing.count += 1;
      sequenceAgg.set(key, existing);

      const samples = sequenceSamples.get(key) ?? [];
      if (samples.length < 2) {
        samples.push(ordered.slice(i, i + len).map((item) => item.id));
        sequenceSamples.set(key, samples);
      }
    }

    result[len] = Array.from(sequenceAgg.values())
      .map(
        (entry): InsightSequenceStat => ({
          sequence: entry.seq,
          count: entry.count,
          evidenceIds: uniqueInsightIds(
            sequenceSamples.get(entry.seq.join('→'))?.flat() ?? [],
          ),
        }),
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }

  return result;
};

const buildStreaks = ({
  ordered,
  stateSequence,
  topN,
}: {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
}): InsightStreakStat[] => {
  const streaks: InsightStreakStat[] = [];
  let currentState = '';
  let currentStart = 0;
  let currentLength = 0;

  for (let i = 0; i < stateSequence.length; i += 1) {
    const state = stateSequence[i];
    if (state === currentState) {
      currentLength += 1;
      continue;
    }

    if (currentLength > 0) {
      streaks.push({
        state: currentState,
        length: currentLength,
        startId: ordered[currentStart]?.id ?? '',
        endId: ordered[i - 1]?.id ?? '',
        evidenceIds: uniqueInsightIds([
          ordered[currentStart]?.id ?? '',
          ordered[i - 1]?.id ?? '',
        ]),
      });
    }

    currentState = state;
    currentStart = i;
    currentLength = 1;
  }

  if (currentLength > 0) {
    streaks.push({
      state: currentState,
      length: currentLength,
      startId: ordered[currentStart]?.id ?? '',
      endId: ordered[ordered.length - 1]?.id ?? '',
      evidenceIds: uniqueInsightIds([
        ordered[currentStart]?.id ?? '',
        ordered[ordered.length - 1]?.id ?? '',
      ]),
    });
  }

  streaks.sort((a, b) => b.length - a.length);
  return streaks.slice(0, topN);
};

const buildDurationExtremes = ({
  ordered,
  dimension,
  topN,
  normalizedTeamInfo,
}: {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}): {
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

const buildPhaseDistribution = ({
  ordered,
  totalEvents,
  timeSpanSec,
  minStart,
  durationSum,
}: {
  ordered: TimelineData[];
  totalEvents: number;
  timeSpanSec: number;
  minStart: number;
  durationSum: number;
}): InsightPhaseStat[] | undefined => {
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

export const buildEventInsightsResult = ({
  ordered,
  dimension,
  topN,
  sequenceLength,
  sequenceLengths,
  normalizedTeamInfo,
}: BuildEventInsightsResultParams): EventInsights => {
  const stateStats = buildStateStats({
    ordered,
    dimension,
    topN,
    normalizedTeamInfo,
  });
  const transitions = buildTransitionStats({
    ordered,
    stateSequence: stateStats.stateSequence,
    topN,
  });
  const topSequencesByLength = buildTopSequencesByLength({
    ordered,
    stateSequence: stateStats.stateSequence,
    topN,
    sequenceLengths,
  });
  const durationExtremes = buildDurationExtremes({
    ordered,
    dimension,
    topN,
    normalizedTeamInfo,
  });
  const phaseDistribution = buildPhaseDistribution({
    ordered,
    totalEvents: stateStats.summary.totalEvents,
    timeSpanSec: stateStats.summary.timeSpanSec,
    minStart: stateStats.minStart,
    durationSum: stateStats.durationSum,
  });

  return {
    summary: stateStats.summary,
    topStates: stateStats.topStates,
    topStatesByDuration: stateStats.topStatesByDuration,
    topTransitions: transitions.topTransitions,
    strongTransitions: transitions.strongTransitions,
    topSequences: topSequencesByLength[sequenceLength] ?? [],
    topSequencesByLength:
      sequenceLengths.length > 1 ? topSequencesByLength : undefined,
    streaks: buildStreaks({
      ordered,
      stateSequence: stateStats.stateSequence,
      topN,
    }),
    rareStates: stateStats.rareStates,
    longestEvents: durationExtremes.longestEvents,
    shortestEvents: durationExtremes.shortestEvents,
    phaseDistribution,
  };
};
