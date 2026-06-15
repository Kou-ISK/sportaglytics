import type { TimelineData } from '../../types/timeline/core';
import { uniqueInsightIds } from './eventInsightsCommon';
import type { InsightTransitionStat } from './eventInsights.types';

interface BuildTransitionStatsParams {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
}

export const buildTransitionStats = ({
  ordered,
  stateSequence,
  topN,
}: BuildTransitionStatsParams): {
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

  transitionStats.sort(
    (a, b) => b.count - a.count || b.probability - a.probability,
  );

  const strongTransitions = transitionStats
    .filter((stat) => stat.count >= 2)
    .sort((a, b) => b.probability - a.probability || b.count - a.count)
    .slice(0, topN);

  return {
    topTransitions: transitionStats.slice(0, topN),
    strongTransitions:
      strongTransitions.length > 0 ? strongTransitions : undefined,
  };
};
