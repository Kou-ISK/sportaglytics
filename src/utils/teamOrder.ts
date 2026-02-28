import type { TimelineData } from '../types/TimelineData';

export const getTimelineTeamOrder = (timeline: TimelineData[]): string[] => {
  const actionNames = Array.from(
    new Set(timeline.map((item) => item.actionName)),
  ).sort((a, b) => a.localeCompare(b));

  const teams: string[] = [];
  for (const actionName of actionNames) {
    const team = actionName.split(' ')[0];
    if (team && !teams.includes(team)) {
      teams.push(team);
    }
  }
  return teams;
};
