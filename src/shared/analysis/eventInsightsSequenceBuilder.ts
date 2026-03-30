import type { TimelineData } from '../../types/TimelineData';
import { uniqueInsightIds } from './eventInsightsCommon';
import type { InsightSequenceStat, InsightStreakStat } from './eventInsights.types';

interface BuildTopSequencesByLengthParams {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
  sequenceLengths: number[];
}

interface BuildStreaksParams {
  ordered: TimelineData[];
  stateSequence: string[];
  topN: number;
}

export const buildTopSequencesByLength = ({
  ordered,
  stateSequence,
  topN,
  sequenceLengths,
}: BuildTopSequencesByLengthParams): Record<number, InsightSequenceStat[]> => {
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

export const buildStreaks = ({
  ordered,
  stateSequence,
  topN,
}: BuildStreaksParams): InsightStreakStat[] => {
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
