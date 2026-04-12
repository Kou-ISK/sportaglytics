import type { SCLabel } from '../../types/SCTimeline';
import type { EvidenceItem } from './aiTypes';
import type {
  AiEvidenceDistributionStat,
  InsightPhaseStat,
} from './eventInsights.types';

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;

type TeamCandidateItem = {
  id: string;
  actionName: string;
  labels?: SCLabel[];
};

export type ResolvedTeamInfo = {
  source: 'label' | 'inferred';
  confidence: number;
  assignments: Map<string, string>;
  teams: string[];
};

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

export const splitTeamActionName = (
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

export const normalizeActionNameForStats = (
  actionName: string,
  teamInfo?: { teams: string[] },
): string => {
  const trimmed = actionName?.trim();
  if (!trimmed) return '未設定';
  if (teamInfo?.teams?.length) {
    const parsed = splitTeamActionName(trimmed);
    if (parsed && teamInfo.teams.includes(parsed.team)) {
      return parsed.action || trimmed;
    }
  }
  return trimmed;
};

export const collectLabelGroupDistributionForItems = (
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

export const buildPhaseDistributionForItems = (
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
    const phase = mid < firstCut ? 'early' : mid < secondCut ? 'mid' : 'late';
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
  evidence: TeamCandidateItem[],
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

export const resolveTeamInfo = (
  evidence: TeamCandidateItem[],
  teamGroup?: string,
): ResolvedTeamInfo | null => {
  const resolveByLabelGroup = (groupName?: string): ResolvedTeamInfo | null => {
    if (!groupName || !groupName.trim()) return null;
    const groupKey = groupName.toLowerCase();
    const assignments = new Map<string, string>();
    for (const item of evidence) {
      const label = (item.labels ?? []).find(
        (entry) => (entry.group ?? '').toLowerCase() === groupKey,
      );
      if (!label?.name) continue;
      assignments.set(item.id, label.name);
    }
    if (assignments.size === 0) return null;
    const confidence =
      evidence.length > 0 ? assignments.size / evidence.length : 0;
    return {
      source: 'label',
      confidence,
      assignments,
      teams: Array.from(new Set(assignments.values())),
    };
  };

  if (teamGroup) {
    const byGroup = resolveByLabelGroup(teamGroup);
    if (byGroup) return byGroup;
  }

  const total = evidence.length;
  if (total > 0) {
    const groupCounts = new Map<string, Map<string, number>>();
    const groupCoverage = new Map<string, number>();
    for (const item of evidence) {
      const seen = new Set<string>();
      for (const label of item.labels ?? []) {
        if (!label.group || !label.name) continue;
        const groupKey = label.group.toLowerCase();
        const counts = groupCounts.get(groupKey) ?? new Map<string, number>();
        counts.set(label.name, (counts.get(label.name) ?? 0) + 1);
        groupCounts.set(groupKey, counts);
        if (!seen.has(groupKey)) {
          groupCoverage.set(groupKey, (groupCoverage.get(groupKey) ?? 0) + 1);
          seen.add(groupKey);
        }
      }
    }

    const candidates = Array.from(groupCounts.entries())
      .map(([group, counts]) => ({
        group,
        counts,
        coverage: (groupCoverage.get(group) ?? 0) / total,
      }))
      .filter(
        (entry) =>
          entry.coverage >= 0.6 &&
          entry.counts.size >= 2 &&
          entry.counts.size <= 4,
      )
      .sort((a, b) => b.coverage - a.coverage);

    if (candidates[0]) {
      const fallback = resolveByLabelGroup(candidates[0].group);
      if (fallback) return fallback;
    }
  }

  const inferred = inferTeamsFromActionNames(evidence);
  if (inferred && inferred.teams.length > 0) {
    return {
      source: 'inferred',
      confidence: inferred.confidence,
      assignments: inferred.assignments,
      teams: inferred.teams,
    };
  }

  return null;
};
