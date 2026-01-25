import { useMemo } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';
import { rechartsData } from '../../../../../../types/RechartsData';
import { useAnalysis } from '../../../../analysis/hooks/useAnalysis';

interface UseStatsPanelStateParams {
  timeline: TimelineData[];
  teamNames: string[];
}

export interface StatsPanelDerivedState {
  possessionData: rechartsData[];
  hasTimelineData: boolean;
  resolvedTeamNames: string[];
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

export const useStatsPanelState = ({
  timeline,
  teamNames,
}: UseStatsPanelStateParams): StatsPanelDerivedState => {
  const {
    calculateActionDuration,
    countActionResultByTeamName,
    countActionTypeByTeamName,
    createMomentumData,
  } = useAnalysis(timeline);

  const possessionData = useMemo(
    () =>
      calculateActionDuration().filter((item) =>
        item.name.includes('ポゼッション'),
      ),
    [calculateActionDuration],
  );

  const hasTimelineData = timeline.length > 0;

  const resolvedTeamNames = useMemo(() => {
    const set = new Set<string>();
    teamNames.forEach((name) => set.add(name));
    timeline.forEach((item) => {
      const [team] = item.actionName.split(' ');
      if (team) {
        set.add(team);
      }
    });
    if (set.size === 0) {
      return ['チームA', 'チームB'];
    }
    return Array.from(set);
  }, [teamNames, timeline]);

  return {
    possessionData,
    hasTimelineData,
    resolvedTeamNames,
    countActionResultByTeamName,
    countActionTypeByTeamName,
    createMomentumData,
  };
};
