import { useMemo } from 'react';
import { rechartsData } from '../../../../../../../types/RechartsData';

interface UseActionBreakdownParams {
  hasData: boolean;
  actions: ReadonlyArray<string>;
  teamNames: ReadonlyArray<string>;
  countActionFunction: (teamName: string, actionName: string) => rechartsData[];
}

export const useActionBreakdown = ({
  hasData,
  actions,
  teamNames,
  countActionFunction,
}: UseActionBreakdownParams) => {
  const resolved = useMemo(() => {
    if (!hasData || actions.length === 0) return [];

    return actions.map((actionName) => ({
      actionName,
      teams: teamNames.map((team) => ({
        team,
        data: countActionFunction(team, actionName),
      })),
    }));
  }, [hasData, actions, teamNames, countActionFunction]);

  return resolved;
};
