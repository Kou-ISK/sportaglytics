import { useMemo } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { DashboardSeriesFilter } from '../../../../../../types/Settings';
import {
  extractActionFromActionName,
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
} from '../../../../../../utils/labelExtractors';
import { getTimelineTeamOrder } from '../../../../../../utils/teamOrder';
import { buildFilterChips } from './dashboardTabController.utils';

interface UseDashboardTabDerivedParams {
  timeline: TimelineData[];
  teamNames: string[];
  dashboardFilters: DashboardSeriesFilter;
}

export const useDashboardTabDerived = ({
  timeline,
  teamNames,
  dashboardFilters,
}: UseDashboardTabDerivedParams) => {
  const availableGroups = useMemo(() => extractUniqueGroups(timeline), [timeline]);

  const availableTeams = useMemo(() => {
    const fromProps = teamNames?.filter(Boolean) ?? [];
    if (fromProps.length > 0) return fromProps;
    return extractUniqueTeams(timeline);
  }, [teamNames, timeline]);

  const availableActions = useMemo(() => {
    const actionSet = new Set<string>();
    for (const item of timeline) {
      const action = extractActionFromActionName(item.actionName);
      if (action) actionSet.add(action);
    }
    return Array.from(actionSet).sort((a, b) => a.localeCompare(b));
  }, [timeline]);

  const availableLabelValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of availableGroups) {
      map[group] = extractUniqueLabelsForGroup(timeline, group);
    }
    return map;
  }, [availableGroups, timeline]);

  const orderedTeams = useMemo(() => {
    const fromTimeline = getTimelineTeamOrder(timeline).filter(Boolean);
    if (fromTimeline.length > 0) return fromTimeline;
    return availableTeams;
  }, [availableTeams, timeline]);

  const teamRoleMap = useMemo(
    () => ({
      team1: orderedTeams[0],
      team2: orderedTeams[1],
    }),
    [orderedTeams],
  );

  const teamContext = useMemo(
    () => ({
      team1Name: orderedTeams[0] || 'Team1',
      team2Name: orderedTeams[1] || 'Team2',
    }),
    [orderedTeams],
  );

  const appliedFilterChips = useMemo(
    () => buildFilterChips('全体', dashboardFilters, teamRoleMap),
    [dashboardFilters, teamRoleMap.team1, teamRoleMap.team2],
  );

  const timelineMap = useMemo(() => new Map(timeline.map((item) => [item.id, item])), [timeline]);

  return {
    availableGroups,
    availableTeams,
    availableActions,
    availableLabelValues,
    orderedTeams,
    teamRoleMap,
    teamContext,
    appliedFilterChips,
    timelineMap,
  };
};
