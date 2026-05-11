import type { TimelineData } from '../../../../types/timeline/core';
import type { RechartsDatum } from '../../../../types/analysis/chart';
import { getLabelByGroupWithFallback } from '../../../../utils/labelExtractors';

type ActionAccumulator = Map<string, number>;

const createAccumulator = () => new Map<string, number>();

const increment = (acc: ActionAccumulator, key: string, amount: number) => {
  if (!key) return;
  const current = acc.get(key) ?? 0;
  acc.set(key, current + amount);
};

const toRechartsData = (acc: ActionAccumulator): RechartsDatum[] => {
  return Array.from(acc.entries()).map(([name, value]) => ({ name, value }));
};

const sortByValueDesc = (data: RechartsDatum[]) =>
  [...data].sort((a, b) => b.value - a.value);

const sortByNameDesc = (data: RechartsDatum[]) =>
  [...data].sort((a, b) => -a.name.localeCompare(b.name));

const sortByNameAsc = (data: RechartsDatum[]) =>
  [...data].sort((a, b) => a.name.localeCompare(b.name));

export const aggregateActionDurations = (
  timeline: TimelineData[],
): RechartsDatum[] => {
  const acc = createAccumulator();
  timeline.forEach(({ actionName, startTime, endTime }) => {
    const duration = Math.max(0, endTime - startTime);
    increment(acc, actionName, duration);
  });
  return sortByValueDesc(toRechartsData(acc));
};

export const countActions = (timeline: TimelineData[]): RechartsDatum[] => {
  const acc = createAccumulator();
  timeline.forEach(({ actionName }) => {
    increment(acc, actionName, 1);
  });
  return sortByNameAsc(toRechartsData(acc));
};

const filterByTeamAndAction = (
  timeline: TimelineData[],
  teamName: string,
  actionName: string,
) => timeline.filter((item) => item.actionName === `${teamName} ${actionName}`);

export const countActionResultsForTeam = (
  timeline: TimelineData[],
  teamName: string,
  actionName: string,
): RechartsDatum[] => {
  const acc = createAccumulator();
  filterByTeamAndAction(timeline, teamName, actionName).forEach((item) => {
    const actionResult = getLabelByGroupWithFallback(item, 'actionResult', '');
    if (!actionResult || actionResult === 'Reset') return;
    increment(acc, actionResult, 1);
  });
  return sortByNameDesc(toRechartsData(acc));
};

export const countActionTypesForTeam = (
  timeline: TimelineData[],
  teamName: string,
  actionName: string,
): RechartsDatum[] => {
  const acc = createAccumulator();
  filterByTeamAndAction(timeline, teamName, actionName).forEach((item) => {
    const actionType = getLabelByGroupWithFallback(
      item,
      'actionType',
      '未設定',
    );
    increment(acc, actionType, 1);
  });
  return sortByNameDesc(toRechartsData(acc));
};
