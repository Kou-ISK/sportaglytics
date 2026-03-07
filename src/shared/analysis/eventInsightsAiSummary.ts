import type {
  AiInsightFacts,
  AiSummaryAnchor,
  EventInsights,
} from './eventInsights.types';
import { uniqueIds } from './eventInsightsAiUtils';

export const buildSummaryAnchors = (params: {
  insight: EventInsights;
  evidenceStats: AiInsightFacts['evidenceStats'];
  teamStats?: AiInsightFacts['teamStats'];
  focus?: AiInsightFacts['analysisFocus'];
  contextStats?: AiInsightFacts['contextStats'];
}): AiSummaryAnchor[] => {
  const candidates: Array<AiSummaryAnchor & { key: string }> = [];
  const addCandidate = (key: string, text: string, evidenceIds: string[]) => {
    const ids = uniqueIds(evidenceIds);
    if (!text || ids.length === 0) return;
    candidates.push({ key, text, evidenceIds: ids });
  };

  const teamStats = params.teamStats;
  if (teamStats && teamStats.teams.length > 0 && teamStats.confidence >= 0.4) {
    const sortedTeams = [...teamStats.teams].sort((a, b) => b.share - a.share);
    if (sortedTeams.length >= 2) {
      const diff = sortedTeams[0].share - sortedTeams[1].share;
      if (diff >= 0.2) {
        const share = Math.round(sortedTeams[0].share * 100);
        addCandidate(
          'team',
          `イベント数は${sortedTeams[0].team}が多い傾向 (${share}%)`,
          sortedTeams[0].evidenceIds,
        );
      }
    } else if (sortedTeams[0].share >= 0.7) {
      const share = Math.round(sortedTeams[0].share * 100);
      addCandidate(
        'team',
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
        addCandidate(
          'team-phase',
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
        addCandidate(
          'team-result',
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
    addCandidate(
      'action',
      `頻出アクション: ${topAction.key} (${topAction.count}件, ${share}%)`,
      topAction.evidenceIds,
    );
  }

  const topActionDuration = params.evidenceStats.actionDurationDistribution?.[0];
  if (topActionDuration && topActionDuration.key !== topAction?.key) {
    const share = Math.round((topActionDuration.shareDuration ?? 0) * 100);
    addCandidate(
      'duration',
      `長時間アクション: ${topActionDuration.key} (${share}%の滞在)`,
      topActionDuration.evidenceIds,
    );
  }

  const topTeam = params.evidenceStats.teamDistribution?.[0];
  if (topTeam && (!teamStats || teamStats.teams.length === 0)) {
    const share = Math.round(topTeam.share * 100);
    addCandidate(
      'team',
      `チーム傾向: ${topTeam.key} (${topTeam.count}件, ${share}%)`,
      topTeam.evidenceIds,
    );
  }

  const strongTransition =
    params.insight.strongTransitions?.[0] ?? params.insight.topTransitions[0];
  if (strongTransition) {
    const share = Math.round(strongTransition.probability * 100);
    addCandidate(
      'flow',
      `強い遷移: ${strongTransition.from}→${strongTransition.to} (${share}%)`,
      strongTransition.evidenceIds,
    );
  }

  const topSequence = params.insight.topSequences[0];
  if (topSequence) {
    addCandidate(
      'flow',
      `繰り返しシーケンス: ${topSequence.sequence.join('→')}`,
      topSequence.evidenceIds,
    );
  }

  const phaseDistribution = params.insight.phaseDistribution;
  if (phaseDistribution && phaseDistribution.length > 0) {
    const phase = [...phaseDistribution].sort((a, b) => b.shareCount - a.shareCount)[0];
    if (phase && phase.shareCount >= 0.45) {
      const phaseLabel =
        phase.phase === 'early' ? '前半' : phase.phase === 'mid' ? '中盤' : '後半';
      const share = Math.round(phase.shareCount * 100);
      addCandidate(
        'phase',
        `イベントが${phaseLabel}に集中 (${share}%)`,
        phase.evidenceIds,
      );
    }
  }

  const contextStats = params.contextStats;
  if (contextStats) {
    const prev = contextStats.prevActions[0];
    if (prev) {
      addCandidate(
        'context',
        `${contextStats.target} の直前は「${prev.key}」が多い傾向があります。`,
        prev.evidenceIds,
      );
    }
    const next = contextStats.nextActions[0];
    if (next) {
      addCandidate(
        'context',
        `${contextStats.target} の直後は「${next.key}」が多い傾向があります。`,
        next.evidenceIds,
      );
    }
  }

  const focusPriority = params.focus?.priority ?? [];
  const basePriority = [
    'team',
    'team-phase',
    'team-result',
    'context',
    'flow',
    'phase',
    'result',
    'action',
    'duration',
  ];
  const priority = Array.from(new Set([...focusPriority, ...basePriority]));
  const priorityIndex = new Map(priority.map((key, index) => [key, index]));

  let filtered = candidates;
  if (focusPriority.length > 0) {
    filtered = candidates.filter((candidate) => focusPriority.includes(candidate.key));
  }
  if (filtered.length === 0 && params.focus?.intents?.includes('phase')) {
    const fallbackIds = params.evidenceStats.actionDistribution[0]?.evidenceIds ?? [];
    if (fallbackIds.length > 0) {
      filtered.push({
        key: 'phase',
        text: '時間帯の偏りは明確ではありません。',
        evidenceIds: uniqueIds(fallbackIds),
      });
    }
  }

  filtered.sort((a, b) => {
    const aIndex = priorityIndex.get(a.key) ?? priority.length;
    const bIndex = priorityIndex.get(b.key) ?? priority.length;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return 0;
  });

  return filtered.slice(0, 4).map(({ key: _key, ...rest }) => rest);
};
