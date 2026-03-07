import type { EvidenceItem } from './aiTypes';
import type {
  AiEvidenceDistributionStat,
  AiTeamStat,
} from './eventInsights.types';
import {
  buildPhaseDistributionForItems,
  collectLabelGroupDistributionForItems,
  splitTeamActionName,
  type ResolvedTeamInfo,
} from './eventInsightsTeamInfo';
import { uniqueIds } from './eventInsightsAiUtils';

export const buildTeamStats = (
  evidence: EvidenceItem[],
  teamInfo: ResolvedTeamInfo,
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
