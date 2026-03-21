import { useMemo } from 'react';
import { TimelineData } from '../../../../types/TimelineData';
import { rechartsData } from '../../../../types/RechartsData';
import {
  aggregateActionDurations,
  countActions as countActionsAggregate,
  countActionResultsForTeam,
  countActionTypesForTeam,
} from '../utils/actionAggregations';
import { createMomentumDataFactory } from '../utils/momentum';
import { CreateMomentumDataFn } from '../../../../types/Analysis';

interface AnalysisSelectors {
  calculateActionDuration: () => rechartsData[];
  countActions: () => rechartsData[];
  countActionResultByTeamName: (
    teamName: string,
    actionName: string,
  ) => rechartsData[];
  countActionTypeByTeamName: (
    teamName: string,
    actionName: string,
  ) => rechartsData[];
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
