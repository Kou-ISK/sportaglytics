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
  analysisFocus?: {
    intents: string[];
    priority: string[];
    notes?: string;
  };
  contextStats?: {
    target: string;
    prevActions: AiEvidenceDistributionStat[];
    nextActions: AiEvidenceDistributionStat[];
    evidenceIds: string[];
  };
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
