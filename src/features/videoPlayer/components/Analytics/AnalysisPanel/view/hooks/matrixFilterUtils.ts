import type { TimelineData } from '../../../../../../../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  extractUniqueTeams,
} from '../../../../../../../utils/labelExtractors';

export const MATRIX_FILTER_ALL = 'all';

export interface MatrixFilterState {
  team: string;
  action: string;
  labelGroup: string;
  labelValue: string;
}

export interface MatrixFilterDerived {
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: string[];
  filteredTimeline: TimelineData[];
  hasActiveFilters: boolean;
}

export const createDefaultMatrixFilters = (): MatrixFilterState => ({
  team: MATRIX_FILTER_ALL,
  action: MATRIX_FILTER_ALL,
  labelGroup: MATRIX_FILTER_ALL,
  labelValue: MATRIX_FILTER_ALL,
});

export const deriveMatrixFilters = (
  timeline: TimelineData[],
  filters: MatrixFilterState,
): MatrixFilterDerived => {
  const availableTeams = extractUniqueTeams(timeline);

  const filteredByTeam =
    filters.team === MATRIX_FILTER_ALL
      ? timeline
      : timeline.filter(
          (item) => extractTeamFromActionName(item.actionName) === filters.team,
        );

  const availableActions = Array.from(
    new Set(filteredByTeam.map((item) => extractActionFromActionName(item.actionName))),
  ).sort((a, b) => a.localeCompare(b));

  const availableLabelValues =
    filters.labelGroup === MATRIX_FILTER_ALL
      ? []
      : Array.from(
          new Set(
            timeline
              .map((item) =>
                item.labels?.find((l) => l.group === filters.labelGroup)?.name,
              )
              .filter((v): v is string => Boolean(v)),
          ),
        ).sort((a, b) => a.localeCompare(b));

  const filteredTimeline = timeline.filter((item) => {
    if (filters.team !== MATRIX_FILTER_ALL) {
      const team = extractTeamFromActionName(item.actionName);
      if (team !== filters.team) return false;
    }

    if (filters.action !== MATRIX_FILTER_ALL) {
      const action = extractActionFromActionName(item.actionName);
      if (action !== filters.action) return false;
    }

    if (filters.labelGroup !== MATRIX_FILTER_ALL) {
      const labels = item.labels?.filter((l) => l.group === filters.labelGroup) ?? [];
      if (labels.length === 0) return false;
      if (filters.labelValue !== MATRIX_FILTER_ALL) {
        const matched = labels.some((label) => label.name === filters.labelValue);
        if (!matched) return false;
      }
    }

    return true;
  });

  const hasActiveFilters =
    filters.team !== MATRIX_FILTER_ALL ||
    filters.action !== MATRIX_FILTER_ALL ||
    filters.labelGroup !== MATRIX_FILTER_ALL;

  return {
    availableTeams,
    availableActions,
    availableLabelValues,
    filteredTimeline,
    hasActiveFilters,
  };
};

export const buildMatrixFilterSummaryText = (filters: MatrixFilterState): string => {
  const parts: string[] = [];
  if (filters.team !== MATRIX_FILTER_ALL) parts.push(`team=${filters.team}`);
  if (filters.action !== MATRIX_FILTER_ALL) parts.push(`action=${filters.action}`);
  if (filters.labelGroup !== MATRIX_FILTER_ALL) {
    if (filters.labelValue !== MATRIX_FILTER_ALL) {
      parts.push(`label=${filters.labelGroup}:${filters.labelValue}`);
    } else {
      parts.push(`labelGroup=${filters.labelGroup}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'none';
};
