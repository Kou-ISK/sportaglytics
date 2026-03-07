import type { TimelineData } from '../../types/TimelineData';
import type { AiInsightFacts } from './eventInsights.types';
import { normalizeActionNameForStats } from './eventInsightsTeamInfo';
import { uniqueIds } from './eventInsightsAiUtils';

export const detectTargetFromQuestion = (
  question: string | undefined,
  timeline: TimelineData[],
  teamInfo?: { teams: string[] },
): string | null => {
  const text = (question ?? '').trim();
  if (!text) return null;
  const candidates = new Set<string>();
  for (const item of timeline) {
    if (item.actionName) {
      const normalized = normalizeActionNameForStats(item.actionName, teamInfo);
      if (normalized && normalized !== '未設定') {
        candidates.add(normalized);
      }
    }
  }
  const ordered = Array.from(candidates).sort((a, b) => b.length - a.length);
  for (const candidate of ordered) {
    if (text.includes(candidate)) return candidate;
  }
  return null;
};

export const buildContextStats = (params: {
  timeline: TimelineData[];
  target: string;
  teamInfo?: { teams: string[] };
}): AiInsightFacts['contextStats'] | undefined => {
  const ordered = [...params.timeline].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.endTime - b.endTime;
  });
  const prevCounts = new Map<string, { count: number; ids: string[] }>();
  const nextCounts = new Map<string, { count: number; ids: string[] }>();
  const evidenceIds: string[] = [];

  const isTarget = (item: TimelineData) => {
    const action = normalizeActionNameForStats(item.actionName ?? '', params.teamInfo);
    return action === params.target;
  };

  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
    if (!isTarget(item)) continue;
    evidenceIds.push(item.id);
    const prev = ordered[i - 1];
    if (prev) {
      const prevAction = normalizeActionNameForStats(prev.actionName ?? '', params.teamInfo);
      const entry = prevCounts.get(prevAction) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      prevCounts.set(prevAction, entry);
    }
    const next = ordered[i + 1];
    if (next) {
      const nextAction = normalizeActionNameForStats(next.actionName ?? '', params.teamInfo);
      const entry = nextCounts.get(nextAction) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      nextCounts.set(nextAction, entry);
    }
  }

  const buildDistribution = (counts: Map<string, { count: number; ids: string[] }>) =>
    Array.from(counts.entries())
      .map(([key, value]) => ({
        key,
        count: value.count,
        share: evidenceIds.length > 0 ? value.count / evidenceIds.length : 0,
        evidenceIds: uniqueIds(value.ids),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

  if (evidenceIds.length === 0) return undefined;
  return {
    target: params.target,
    prevActions: buildDistribution(prevCounts),
    nextActions: buildDistribution(nextCounts),
    evidenceIds: uniqueIds(evidenceIds),
  };
};
