import type { TimelineData } from '../../../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../../../utils/labelExtractors';
import type { EvidenceFilters, EvidenceItem } from '../ai/types';

export type InsightDimension =
  | { type: 'action' }
  | { type: 'labelGroup'; group: string };

export type InsightStateStat = {
  state: string;
  count: number;
  share: number;
  totalDuration: number;
  avgDuration: number;
  durationShare?: number;
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

export type InsightPhaseStat = {
  phase: 'early' | 'mid' | 'late';
  count: number;
  shareCount: number;
  totalDuration: number;
  shareDuration: number;
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
  topStatesByDuration?: InsightStateStat[];
  topTransitions: InsightTransitionStat[];
  strongTransitions?: InsightTransitionStat[];
  topSequences: InsightSequenceStat[];
  topSequencesByLength?: Record<number, InsightSequenceStat[]>;
  streaks: InsightStreakStat[];
  rareStates: InsightStateStat[];
  longestEvents: InsightEventStat[];
  shortestEvents?: InsightEventStat[];
  phaseDistribution?: InsightPhaseStat[];
};

export type AiEvidenceDistributionStat = {
  key: string;
  count: number;
  share: number;
  evidenceIds: string[];
  totalDuration?: number;
  avgDuration?: number;
  shareDuration?: number;
};

export type AiSummaryAnchor = {
  text: string;
  evidenceIds: string[];
};

export type AiTeamStat = {
  team: string;
  count: number;
  share: number;
  totalDuration: number;
  shareDuration: number;
  evidenceIds: string[];
  topActions?: AiEvidenceDistributionStat[];
  topResults?: AiEvidenceDistributionStat[];
  phaseDistribution?: InsightPhaseStat[];
};

export type AiInsightFacts = {
  dimension: string;
  summary: EventInsights['summary'];
  topStates: InsightStateStat[];
  topStatesByDuration?: InsightStateStat[];
  rareStates: InsightStateStat[];
  topTransitions: InsightTransitionStat[];
  strongTransitions?: InsightTransitionStat[];
  topSequences: InsightSequenceStat[];
  topSequencesByLength?: Record<number, InsightSequenceStat[]>;
  longestEvents: InsightEventStat[];
  shortestEvents?: InsightEventStat[];
  phaseDistribution?: InsightPhaseStat[];
  streaks: InsightStreakStat[];
  summaryAnchors?: AiSummaryAnchor[];
  teamStats?: {
    source: 'label' | 'inferred';
    confidence: number;
    teams: AiTeamStat[];
  };
  evidenceStats: {
    evidenceCount: number;
    timeSpanSec: number;
    actionDistribution: AiEvidenceDistributionStat[];
    labelDistribution: AiEvidenceDistributionStat[];
    actionDurationDistribution?: AiEvidenceDistributionStat[];
    teamDistribution?: AiEvidenceDistributionStat[];
    phaseDistribution?: InsightPhaseStat[];
  };
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
    sequenceLengths?: number[];
  },
): EventInsights => {
  const topN = Math.max(1, config.topN ?? 5);
  const sequenceLength = Math.max(2, config.sequenceLength ?? 3);
  const sequenceLengths = Array.from(
    new Set(
      (config.sequenceLengths && config.sequenceLengths.length > 0
        ? config.sequenceLengths
        : [sequenceLength]
      ).map((len) => Math.max(2, len)),
    ),
  );
  const ordered = sortTimeline(timeline);
  const totalEvents = ordered.length;
  const stateSamples = new Map<string, string[]>();
  const transitionSamples = new Map<string, string[][]>();
  const sequenceSamplesByLength = new Map<number, Map<string, string[][]>>();

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
      durationShare: durationSum > 0 ? value.duration / durationSum : 0,
      evidenceIds: uniqueIds(stateSamples.get(state) ?? []),
    }),
  );

  stateStats.sort((a, b) => b.count - a.count || b.totalDuration - a.totalDuration);
  const topStates = stateStats.slice(0, topN);
  const topStatesByDuration = [...stateStats]
    .sort((a, b) => b.totalDuration - a.totalDuration || b.count - a.count)
    .slice(0, topN);

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
  const strongTransitions = transitionStats
    .filter((stat) => stat.count >= 2)
    .sort((a, b) => b.probability - a.probability || b.count - a.count)
    .slice(0, topN);

  const buildSequenceStats = (len: number): InsightSequenceStat[] => {
    const sequenceAgg = new Map<string, { count: number; seq: string[] }>();
    const sequenceSamples =
      sequenceSamplesByLength.get(len) ?? new Map<string, string[][]>();
    for (let i = 0; i <= stateSequence.length - len; i += 1) {
      const seq = stateSequence.slice(i, i + len);
      const key = seq.join('→');
      const existing = sequenceAgg.get(key) ?? { count: 0, seq };
      existing.count += 1;
      sequenceAgg.set(key, existing);
      const samples = sequenceSamples.get(key) ?? [];
      if (samples.length < 2) {
        const ids = ordered.slice(i, i + len).map((item) => item.id);
        samples.push(ids);
        sequenceSamples.set(key, samples);
      }
    }
    sequenceSamplesByLength.set(len, sequenceSamples);
    return Array.from(sequenceAgg.values())
      .map((entry) => {
        const key = entry.seq.join('→');
        const samples = sequenceSamples.get(key) ?? [];
        const evidenceIds = uniqueIds(samples.flat());
        return { sequence: entry.seq, count: entry.count, evidenceIds };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  };

  const topSequencesByLength: Record<number, InsightSequenceStat[]> = {};
  for (const len of sequenceLengths) {
    topSequencesByLength[len] = buildSequenceStats(len);
  }
  const sequenceStats =
    topSequencesByLength[sequenceLength] ?? buildSequenceStats(sequenceLength);

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
  const shortestEvents = ordered
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
    .sort((a, b) => a.duration - b.duration)
    .slice(0, topN);

  const phaseDistribution: InsightPhaseStat[] = [];
  if (totalEvents > 0 && timeSpanSec > 0 && Number.isFinite(minStart)) {
    const firstCut = minStart + timeSpanSec / 3;
    const secondCut = minStart + (2 * timeSpanSec) / 3;
    const phaseBuckets = new Map<
      InsightPhaseStat['phase'],
      { count: number; duration: number; ids: string[] }
    >();
    const phases: InsightPhaseStat['phase'][] = ['early', 'mid', 'late'];
    phases.forEach((phase) =>
      phaseBuckets.set(phase, { count: 0, duration: 0, ids: [] }),
    );
    for (const item of ordered) {
      const mid = (item.startTime + item.endTime) / 2;
      const phase =
        mid < firstCut ? 'early' : mid < secondCut ? 'mid' : 'late';
      const bucket = phaseBuckets.get(phase);
      if (!bucket) continue;
      bucket.count += 1;
      bucket.duration += safeDuration(item);
      if (bucket.ids.length < 5) {
        bucket.ids.push(item.id);
      }
    }
    for (const phase of phases) {
      const bucket = phaseBuckets.get(phase);
      if (!bucket) continue;
      phaseDistribution.push({
        phase,
        count: bucket.count,
        shareCount: totalEvents > 0 ? bucket.count / totalEvents : 0,
        totalDuration: bucket.duration,
        shareDuration: durationSum > 0 ? bucket.duration / durationSum : 0,
        evidenceIds: uniqueIds(bucket.ids),
      });
    }
  }

  return {
    summary: {
      totalEvents,
      uniqueStates: stateStats.length,
      timeSpanSec,
      eventsPerMin,
      avgDuration: totalEvents > 0 ? durationSum / totalEvents : 0,
    },
    topStates,
    topStatesByDuration,
    topTransitions,
    strongTransitions: strongTransitions.length > 0 ? strongTransitions : undefined,
    topSequences: sequenceStats,
    topSequencesByLength:
      sequenceLengths.length > 1 ? topSequencesByLength : undefined,
    streaks: streaks.slice(0, topN),
    rareStates,
    longestEvents,
    shortestEvents,
    phaseDistribution: phaseDistribution.length > 0 ? phaseDistribution : undefined,
  };
};

const collectEvidenceDistribution = (
  evidence: EvidenceItem[],
  type: 'action' | 'label',
  limit = 6,
): AiEvidenceDistributionStat[] => {
  const counts = new Map<string, { count: number; ids: string[] }>();
  for (const item of evidence) {
    if (type === 'action') {
      const key = item.actionName || '未設定';
      const entry = counts.get(key) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      counts.set(key, entry);
    } else {
      for (const label of item.labels) {
        const key = label.group ? `${label.group}:${label.name}` : label.name;
        const entry = counts.get(key) ?? { count: 0, ids: [] };
        entry.count += 1;
        if (entry.ids.length < 5) entry.ids.push(item.id);
        counts.set(key, entry);
      }
    }
  }

  const total = evidence.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      count: value.count,
      share: total > 0 ? value.count / total : 0,
      evidenceIds: uniqueIds(value.ids),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const collectEvidenceDurationDistribution = (
  evidence: EvidenceItem[],
  limit = 6,
): AiEvidenceDistributionStat[] => {
  const counts = new Map<string, { count: number; duration: number; ids: string[] }>();
  let totalDuration = 0;
  for (const item of evidence) {
    const key = item.actionName || '未設定';
    const duration = Math.max(0, item.endTime - item.startTime);
    totalDuration += duration;
    const entry = counts.get(key) ?? { count: 0, duration: 0, ids: [] };
    entry.count += 1;
    entry.duration += duration;
    if (entry.ids.length < 5) entry.ids.push(item.id);
    counts.set(key, entry);
  }

  const total = evidence.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      count: value.count,
      share: total > 0 ? value.count / total : 0,
      totalDuration: value.duration,
      avgDuration: value.count > 0 ? value.duration / value.count : 0,
      shareDuration: totalDuration > 0 ? value.duration / totalDuration : 0,
      evidenceIds: uniqueIds(value.ids),
    }))
    .sort(
      (a, b) =>
        (b.totalDuration ?? 0) - (a.totalDuration ?? 0) ||
        b.count - a.count,
    )
    .slice(0, limit);
};

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;

const splitTeamActionName = (
  actionName: string,
): { team: string; action: string } | null => {
  const trimmed = (actionName ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(TEAM_SPLIT_REGEX).filter(Boolean);
  if (parts.length < 2) return null;
  const team = parts[0]?.trim();
  const action = parts.slice(1).join(' ').trim();
  if (!team || !action) return null;
  if (/^[\d\W]+$/.test(team)) return null;
  return { team, action };
};

const collectLabelGroupDistributionForItems = (
  items: EvidenceItem[],
  group: string,
  limit = 3,
): AiEvidenceDistributionStat[] => {
  const counts = new Map<string, { count: number; ids: string[] }>();
  const groupKey = group.toLowerCase();
  for (const item of items) {
    for (const label of item.labels) {
      if ((label.group ?? '').toLowerCase() !== groupKey) continue;
      const key = label.name || '未設定';
      const entry = counts.get(key) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      counts.set(key, entry);
    }
  }
  const total = items.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      count: value.count,
      share: total > 0 ? value.count / total : 0,
      evidenceIds: uniqueIds(value.ids),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const buildPhaseDistributionForItems = (
  items: EvidenceItem[],
  minStart: number,
  maxEnd: number,
): InsightPhaseStat[] => {
  const timeSpanSec =
    items.length === 0 || !Number.isFinite(minStart) || !Number.isFinite(maxEnd)
      ? 0
      : Math.max(0, maxEnd - minStart);
  if (timeSpanSec <= 0) return [];
  const firstCut = minStart + timeSpanSec / 3;
  const secondCut = minStart + (2 * timeSpanSec) / 3;

  const phases: InsightPhaseStat['phase'][] = ['early', 'mid', 'late'];
  const buckets = new Map<
    InsightPhaseStat['phase'],
    { count: number; duration: number; ids: string[] }
  >();
  phases.forEach((phase) =>
    buckets.set(phase, { count: 0, duration: 0, ids: [] }),
  );

  let durationSum = 0;
  for (const item of items) {
    const mid = (item.startTime + item.endTime) / 2;
    const phase =
      mid < firstCut ? 'early' : mid < secondCut ? 'mid' : 'late';
    const bucket = buckets.get(phase);
    if (!bucket) continue;
    const duration = Math.max(0, item.endTime - item.startTime);
    durationSum += duration;
    bucket.count += 1;
    bucket.duration += duration;
    if (bucket.ids.length < 5) bucket.ids.push(item.id);
  }

  const total = items.length;
  return phases.map((phase) => {
    const bucket = buckets.get(phase)!;
    return {
      phase,
      count: bucket.count,
      shareCount: total > 0 ? bucket.count / total : 0,
      totalDuration: bucket.duration,
      shareDuration: durationSum > 0 ? bucket.duration / durationSum : 0,
      evidenceIds: uniqueIds(bucket.ids),
    };
  });
};

const inferTeamsFromActionNames = (
  evidence: EvidenceItem[],
): {
  teams: string[];
  assignments: Map<string, string>;
  confidence: number;
} | null => {
  const candidateMap = new Map<
    string,
    { count: number; ids: string[]; actions: Set<string> }
  >();

  for (const item of evidence) {
    const parsed = splitTeamActionName(item.actionName);
    if (!parsed) continue;
    const entry = candidateMap.get(parsed.team) ?? {
      count: 0,
      ids: [],
      actions: new Set<string>(),
    };
    entry.count += 1;
    entry.actions.add(parsed.action);
    if (entry.ids.length < 5) entry.ids.push(item.id);
    candidateMap.set(parsed.team, entry);
  }

  const total = evidence.length;
  if (total === 0 || candidateMap.size === 0) return null;
  const minCount = Math.max(2, Math.ceil(total * 0.1));
  const candidates = Array.from(candidateMap.entries())
    .map(([team, info]) => ({
      team,
      count: info.count,
      actions: info.actions.size,
    }))
    .filter((entry) => entry.count >= minCount && entry.actions >= 2)
    .sort((a, b) => b.count - a.count);

  if (candidates.length < 2) return null;
  const topTeams = candidates.slice(0, 3);
  const coverage =
    topTeams.reduce((sum, entry) => sum + entry.count, 0) / total;
  if (coverage < 0.6) return null;

  const teamSet = new Set(topTeams.map((entry) => entry.team));
  const assignments = new Map<string, string>();
  for (const item of evidence) {
    const parsed = splitTeamActionName(item.actionName);
    if (!parsed) continue;
    if (!teamSet.has(parsed.team)) continue;
    assignments.set(item.id, parsed.team);
  }

  const confidence = total > 0 ? assignments.size / total : 0;
  return {
    teams: topTeams.map((entry) => entry.team),
    assignments,
    confidence,
  };
};

const resolveTeamInfo = (
  evidence: EvidenceItem[],
  teamGroup?: string,
): {
  source: 'label' | 'inferred';
  confidence: number;
  assignments: Map<string, string>;
} | null => {
  if (teamGroup && teamGroup.trim().length > 0) {
    const groupKey = teamGroup.toLowerCase();
    const assignments = new Map<string, string>();
    for (const item of evidence) {
      const label = item.labels.find(
        (entry) => (entry.group ?? '').toLowerCase() === groupKey,
      );
      if (!label?.name) continue;
      assignments.set(item.id, label.name);
    }
    if (assignments.size > 0) {
      const confidence =
        evidence.length > 0 ? assignments.size / evidence.length : 0;
      return { source: 'label', confidence, assignments };
    }
  }

  const inferred = inferTeamsFromActionNames(evidence);
  if (inferred && inferred.teams.length > 0) {
    return {
      source: 'inferred',
      confidence: inferred.confidence,
      assignments: inferred.assignments,
    };
  }

  return null;
};

const buildTeamStats = (
  evidence: EvidenceItem[],
  teamInfo: NonNullable<ReturnType<typeof resolveTeamInfo>>,
  minStart: number,
  maxEnd: number,
): {
  teamStats: AiTeamStat[];
  teamDistribution: AiEvidenceDistributionStat[];
} => {
  const teamBuckets = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const team = teamInfo.assignments.get(item.id);
    if (!team) continue;
    const bucket = teamBuckets.get(team) ?? [];
    bucket.push(item);
    teamBuckets.set(team, bucket);
  }

  const total = evidence.length;
  const totalDuration = evidence.reduce(
    (sum, item) => sum + Math.max(0, item.endTime - item.startTime),
    0,
  );

  const teamStats: AiTeamStat[] = Array.from(teamBuckets.entries()).map(
    ([team, items]) => {
      const count = items.length;
      const duration = items.reduce(
        (sum, item) => sum + Math.max(0, item.endTime - item.startTime),
        0,
      );
      const normalizedActions = items.map((item) => {
        if (teamInfo.source === 'inferred') {
          const parsed = splitTeamActionName(item.actionName);
          if (parsed && parsed.team === team) return parsed.action;
        }
        return item.actionName || '未設定';
      });

      const actionCounts = new Map<string, { count: number; ids: string[] }>();
      normalizedActions.forEach((action, index) => {
        const item = items[index];
        const key = action || '未設定';
        const entry = actionCounts.get(key) ?? { count: 0, ids: [] };
        entry.count += 1;
        if (entry.ids.length < 5) entry.ids.push(item.id);
        actionCounts.set(key, entry);
      });
      const actionDistribution = Array.from(actionCounts.entries())
        .map(([key, value]) => ({
          key,
          count: value.count,
          share: count > 0 ? value.count / count : 0,
          evidenceIds: uniqueIds(value.ids),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const resultDistribution = collectLabelGroupDistributionForItems(
        items,
        'actionResult',
        3,
      );

      return {
        team,
        count,
        share: total > 0 ? count / total : 0,
        totalDuration: duration,
        shareDuration: totalDuration > 0 ? duration / totalDuration : 0,
        evidenceIds: uniqueIds(items.map((item) => item.id)),
        topActions: actionDistribution,
        topResults: resultDistribution,
        phaseDistribution: buildPhaseDistributionForItems(items, minStart, maxEnd),
      };
    },
  );

  teamStats.sort((a, b) => b.count - a.count);

  const teamDistribution: AiEvidenceDistributionStat[] = teamStats.map((team) => ({
    key: team.team,
    count: team.count,
    share: team.share,
    evidenceIds: uniqueIds(team.evidenceIds),
  }));

  return { teamStats, teamDistribution };
};

const buildSummaryAnchors = (params: {
  insight: EventInsights;
  evidenceStats: AiInsightFacts['evidenceStats'];
  teamStats?: AiInsightFacts['teamStats'];
}): AiSummaryAnchor[] => {
  const anchors: AiSummaryAnchor[] = [];
  const push = (text: string, evidenceIds: string[]) => {
    const ids = uniqueIds(evidenceIds);
    if (!text || ids.length === 0) return;
    anchors.push({ text, evidenceIds: ids });
  };

  const teamStats = params.teamStats;
  if (teamStats && teamStats.teams.length > 0 && teamStats.confidence >= 0.4) {
    const sortedTeams = [...teamStats.teams].sort((a, b) => b.share - a.share);
    if (sortedTeams.length >= 2) {
      const diff = sortedTeams[0].share - sortedTeams[1].share;
      if (diff >= 0.2) {
        const share = Math.round(sortedTeams[0].share * 100);
        push(
          `イベント数は${sortedTeams[0].team}が多い傾向 (${share}%)`,
          sortedTeams[0].evidenceIds,
        );
      }
    } else if (sortedTeams[0].share >= 0.7) {
      const share = Math.round(sortedTeams[0].share * 100);
      push(
        `イベント数は${sortedTeams[0].team}に偏っています (${share}%)`,
        sortedTeams[0].evidenceIds,
      );
    }

    for (const team of teamStats.teams) {
      if (!team.phaseDistribution || team.phaseDistribution.length === 0) continue;
      const phase = [...team.phaseDistribution].sort(
        (a, b) => b.shareCount - a.shareCount,
      )[0];
      if (phase && phase.shareCount >= 0.55) {
        const phaseLabel =
          phase.phase === 'early'
            ? '前半'
            : phase.phase === 'mid'
              ? '中盤'
              : '後半';
        const share = Math.round(phase.shareCount * 100);
        push(
          `${team.team}のイベントが${phaseLabel}に集中 (${share}%)`,
          phase.evidenceIds,
        );
        break;
      }
    }

    for (const team of teamStats.teams) {
      const topResult = team.topResults?.[0];
      if (topResult && topResult.share >= 0.45) {
        const share = Math.round(topResult.share * 100);
        push(
          `${team.team}の結果は${topResult.key}が多い (${share}%)`,
          topResult.evidenceIds,
        );
        break;
      }
    }
  }

  const topAction = params.evidenceStats.actionDistribution[0];
  if (topAction) {
    const share = Math.round(topAction.share * 100);
    push(`頻出アクション: ${topAction.key} (${topAction.count}件, ${share}%)`, topAction.evidenceIds);
  }

  const topActionDuration = params.evidenceStats.actionDurationDistribution?.[0];
  if (topActionDuration && topActionDuration.key !== topAction?.key) {
    const share = Math.round((topActionDuration.shareDuration ?? 0) * 100);
    push(
      `長時間アクション: ${topActionDuration.key} (${share}%の滞在)`,
      topActionDuration.evidenceIds,
    );
  }

  const topTeam = params.evidenceStats.teamDistribution?.[0];
  if (topTeam && (!teamStats || teamStats.teams.length === 0)) {
    const share = Math.round(topTeam.share * 100);
    push(`チーム傾向: ${topTeam.key} (${topTeam.count}件, ${share}%)`, topTeam.evidenceIds);
  }

  const strongTransition = params.insight.strongTransitions?.[0] ?? params.insight.topTransitions[0];
  if (strongTransition) {
    const share = Math.round(strongTransition.probability * 100);
    push(
      `強い遷移: ${strongTransition.from}→${strongTransition.to} (${share}%)`,
      strongTransition.evidenceIds,
    );
  }

  const topSequence = params.insight.topSequences[0];
  if (topSequence) {
    push(`繰り返しシーケンス: ${topSequence.sequence.join('→')}`, topSequence.evidenceIds);
  }

  const phaseDistribution = params.insight.phaseDistribution;
  if (phaseDistribution && phaseDistribution.length > 0) {
    const phase = [...phaseDistribution].sort(
      (a, b) => b.shareCount - a.shareCount,
    )[0];
    if (phase && phase.shareCount >= 0.45) {
      const phaseLabel =
        phase.phase === 'early' ? '前半' : phase.phase === 'mid' ? '中盤' : '後半';
      const share = Math.round(phase.shareCount * 100);
      push(`イベントが${phaseLabel}に集中 (${share}%)`, phase.evidenceIds);
    }
  }

  return anchors.slice(0, 4);
};

export const buildAiInsightFacts = (
  insight: EventInsights,
  evidence: EvidenceItem[],
  dimension: InsightDimension,
  teamGroup?: string,
): AiInsightFacts => {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const item of evidence) {
    minStart = Math.min(minStart, item.startTime);
    maxEnd = Math.max(maxEnd, item.endTime);
  }
  const timeSpanSec =
    evidence.length === 0 || !Number.isFinite(minStart) || !Number.isFinite(maxEnd)
      ? 0
      : Math.max(0, maxEnd - minStart);

  const actionDurationDistribution = collectEvidenceDurationDistribution(evidence);
  const teamInfo = resolveTeamInfo(evidence, teamGroup);
  const teamStatsResult = teamInfo
    ? buildTeamStats(evidence, teamInfo, minStart, maxEnd)
    : null;

  const evidenceStats: AiInsightFacts['evidenceStats'] = {
    evidenceCount: evidence.length,
    timeSpanSec,
    actionDistribution: collectEvidenceDistribution(evidence, 'action'),
    labelDistribution: collectEvidenceDistribution(evidence, 'label'),
    actionDurationDistribution,
    ...(teamStatsResult?.teamDistribution?.length
      ? { teamDistribution: teamStatsResult.teamDistribution }
      : {}),
    ...(insight.phaseDistribution?.length
      ? { phaseDistribution: insight.phaseDistribution }
      : {}),
  };

  const summaryAnchors = buildSummaryAnchors({
    insight,
    evidenceStats,
    teamStats: teamInfo
      ? {
          source: teamInfo.source,
          confidence: teamInfo.confidence,
          teams: teamStatsResult?.teamStats ?? [],
        }
      : undefined,
  });

  return {
    dimension:
      dimension.type === 'labelGroup' ? `label:${dimension.group}` : 'action',
    summary: insight.summary,
    summaryAnchors,
    teamStats: teamInfo
      ? {
          source: teamInfo.source,
          confidence: teamInfo.confidence,
          teams: teamStatsResult?.teamStats ?? [],
        }
      : undefined,
    evidenceStats,
    topStates: insight.topStates,
    topStatesByDuration: insight.topStatesByDuration,
    rareStates: insight.rareStates,
    topTransitions: insight.topTransitions,
    strongTransitions: insight.strongTransitions,
    topSequences: insight.topSequences,
    topSequencesByLength: insight.topSequencesByLength,
    longestEvents: insight.longestEvents,
    shortestEvents: insight.shortestEvents,
    phaseDistribution: insight.phaseDistribution,
    streaks: insight.streaks,
  };
};
