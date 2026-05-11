import type { TimelineData } from '../../types/timeline/core';
import type { NormalizedInsightTeamInfo } from './eventInsightsCommon';
import {
  buildDurationExtremes,
  buildPhaseDistribution,
} from './eventInsightsDurationBuilder';
import {
  buildTopSequencesByLength,
  buildStreaks,
} from './eventInsightsSequenceBuilder';
import { buildStateStats } from './eventInsightsStateBuilder';
import { buildTransitionStats } from './eventInsightsTransitionBuilder';
import type { EventInsights, InsightDimension } from './eventInsights.types';

interface BuildEventInsightsResultParams {
  ordered: TimelineData[];
  dimension: InsightDimension;
  topN: number;
  sequenceLength: number;
  sequenceLengths: number[];
  normalizedTeamInfo?: NormalizedInsightTeamInfo;
}

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
