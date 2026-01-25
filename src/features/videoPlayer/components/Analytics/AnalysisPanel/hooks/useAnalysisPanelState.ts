import { useMemo } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';
import { rechartsData } from '../../../../../../types/RechartsData';
import { useAnalysis } from '../../../../analysis/hooks/useAnalysis';

interface UseAnalysisPanelStateParams {
  timeline: TimelineData[];
  teamNames: string[];
}

export interface AnalysisPanelDerivedState {
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

export const useAnalysisPanelState = ({
  timeline,
  teamNames,
}: UseAnalysisPanelStateParams): AnalysisPanelDerivedState => {
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
