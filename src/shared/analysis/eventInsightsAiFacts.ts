import type { TimelineData } from '../../types/timeline/core';
import type { EvidenceItem } from './aiTypes';
import type {
  AiInsightFacts,
  EventInsights,
  InsightDimension,
} from './eventInsights.types';
import {
  normalizeActionNameForStats,
  resolveTeamInfo,
} from './eventInsightsTeamInfo';
import {
  collectEvidenceDistribution,
  collectEvidenceDurationDistribution,
  uniqueIds,
} from './eventInsightsAiUtils';
import { buildTeamStats } from './eventInsightsAiTeamStats';
import {
  buildContextStats,
  detectTargetFromQuestion,
} from './eventInsightsAiContext';
import { detectAnalysisFocus } from './eventInsightsAiFocus';
import { buildSummaryAnchors } from './eventInsightsAiSummary';

export const buildAiInsightFacts = (
  insight: EventInsights,
  evidence: EvidenceItem[],
  dimension: InsightDimension,
  teamGroup?: string,
  question?: string,
  fullTimeline?: TimelineData[],
): AiInsightFacts => {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const item of evidence) {
    minStart = Math.min(minStart, item.startTime);
    maxEnd = Math.max(maxEnd, item.endTime);
  }
  const timeSpanSec =
    evidence.length === 0 ||
    !Number.isFinite(minStart) ||
    !Number.isFinite(maxEnd)
      ? 0
      : Math.max(0, maxEnd - minStart);

  const actionDurationDistribution =
    collectEvidenceDurationDistribution(evidence);
  const teamInfo = resolveTeamInfo(evidence, teamGroup);
  const teamStatsResult = teamInfo
    ? buildTeamStats(evidence, teamInfo, minStart, maxEnd)
    : null;

  const teamStats = teamInfo
    ? {
        source: teamInfo.source,
        confidence: teamInfo.confidence,
        teams: teamStatsResult?.teamStats ?? [],
      }
    : undefined;

  const teamInfoForAction = teamStats
    ? {
        source: teamStats.source,
        teams: teamStats.teams.map((team) => team.team),
      }
    : undefined;

  const actionDistribution = (() => {
    if (!teamInfoForAction?.teams?.length) {
      return collectEvidenceDistribution(evidence, 'action');
    }
    const counts = new Map<string, { count: number; ids: string[] }>();
    for (const item of evidence) {
      const key = normalizeActionNameForStats(
        item.actionName,
        teamInfoForAction,
      );
      const entry = counts.get(key) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      counts.set(key, entry);
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
      .slice(0, 6);
  })();

  const evidenceStats: AiInsightFacts['evidenceStats'] = {
    evidenceCount: evidence.length,
    timeSpanSec,
    actionDistribution,
    labelDistribution: collectEvidenceDistribution(evidence, 'label'),
    actionDurationDistribution,
    ...(teamStatsResult?.teamDistribution?.length
      ? { teamDistribution: teamStatsResult.teamDistribution }
      : {}),
    ...(insight.phaseDistribution?.length
      ? { phaseDistribution: insight.phaseDistribution }
      : {}),
  };

  const analysisFocus = detectAnalysisFocus(
    question,
    teamStats?.teams.map((team) => team.team) ?? [],
  );

  const contextTarget =
    question && fullTimeline
      ? detectTargetFromQuestion(question, fullTimeline, teamInfoForAction)
      : null;
  const contextStats =
    contextTarget && fullTimeline
      ? buildContextStats({
          timeline: fullTimeline,
          target: contextTarget,
          teamInfo: teamInfoForAction,
        })
      : undefined;

  const summaryAnchors = buildSummaryAnchors({
    insight,
    evidenceStats,
    teamStats,
    focus: analysisFocus,
    contextStats,
  });

  return {
    dimension:
      dimension.type === 'labelGroup' ? `label:${dimension.group}` : 'action',
    summary: insight.summary,
    summaryAnchors,
    teamStats,
    analysisFocus,
    contextStats,
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
