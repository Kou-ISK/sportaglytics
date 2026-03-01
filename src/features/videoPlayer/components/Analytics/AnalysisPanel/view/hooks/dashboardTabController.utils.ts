import type { DashboardSeriesFilter } from '../../../../../../../types/Settings';

export const generateDashboardId = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const buildFilterChips = (
  prefix: string,
  filters: DashboardSeriesFilter | undefined,
  teamRoleMap: { team1?: string; team2?: string },
): string[] => {
  if (!filters) return [];
  const chips: string[] = [];
  if (filters.team) chips.push(`${prefix} チーム=${filters.team}`);
  if (filters.teamRole) {
    const resolved =
      filters.teamRole === 'team1' ? teamRoleMap.team1 : teamRoleMap.team2;
    chips.push(`${prefix} チーム=${resolved || filters.teamRole}`);
  }
  if (filters.action) chips.push(`${prefix} アクション=${filters.action}`);
  if (filters.labelGroup) {
    const label = filters.labelValue
      ? `${filters.labelGroup}:${filters.labelValue}`
      : filters.labelGroup;
    chips.push(`${prefix} ラベル=${label}`);
  }
  return chips;
};
