import { useMemo } from 'react';
import type { TimelineData } from '../../../../types/TimelineData';
import type { RechartsDatum } from '../../../../types/RechartsData';
import {
  aggregateActionDurations,
  countActions as countActionsAggregate,
  countActionResultsForTeam,
  countActionTypesForTeam,
} from '../utils/actionAggregations';
import { createMomentumDataFactory } from '../utils/momentum';
import type { CreateMomentumDataFn } from '../../../../types/Analysis';

interface AnalysisSelectors {
  calculateActionDuration: () => RechartsDatum[];
  countActions: () => RechartsDatum[];
  countActionResultByTeamName: (
    teamName: string,
    actionName: string,
  ) => RechartsDatum[];
  countActionTypeByTeamName: (
    teamName: string,
    actionName: string,
  ) => RechartsDatum[];
  createMomentumData: CreateMomentumDataFn;
}

export const useAnalysis = (timeline: TimelineData[]): AnalysisSelectors => {
  return useMemo(() => {
    return {
      calculateActionDuration: () => aggregateActionDurations(timeline),
      countActions: () => countActionsAggregate(timeline),
      countActionResultByTeamName: (teamName: string, actionName: string) =>
        countActionResultsForTeam(timeline, teamName, actionName),
      countActionTypeByTeamName: (teamName: string, actionName: string) =>
        countActionTypesForTeam(timeline, teamName, actionName),
      createMomentumData: createMomentumDataFactory(timeline),
    };
  }, [timeline]);
};
