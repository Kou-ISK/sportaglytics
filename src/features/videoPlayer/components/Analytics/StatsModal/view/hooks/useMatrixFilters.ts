import { useEffect, useMemo, useState } from 'react';
import { TimelineData } from '../../../../../../../types//TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  extractUniqueTeams,
} from '../../../../../../../utils/labelExtractors';

const ALL = 'all';

export interface MatrixFilterState {
  team: string;
  action: string;
  labelGroup: string;
  labelValue: string;
}

export interface MatrixFiltersResult {
  filters: MatrixFilterState;
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: string[];
  filteredTimeline: TimelineData[];
  hasActiveFilters: boolean;
  setFilterTeam: (value: string) => void;
  setFilterAction: (value: string) => void;
  setFilterLabelGroup: (value: string) => void;
  setFilterLabelValue: (value: string) => void;
  clearLabelFilters: () => void;
  clearAllFilters: () => void;
}

/**
 * MatrixTab のフィルタ状態と派生データをまとめるカスタムフック
 * UI とロジックを分離し、再利用しやすくする
 */
export const useMatrixFilters = (
  timeline: TimelineData[],
): MatrixFiltersResult => {
  const [filterTeam, setFilterTeam] = useState<string>(ALL);
  const [filterAction, setFilterAction] = useState<string>(ALL);
  const [filterLabelGroup, setFilterLabelGroup] = useState<string>(ALL);
  const [filterLabelValue, setFilterLabelValue] = useState<string>(ALL);

  // availableActions/LabelValues を算出
  const { availableTeams, availableActions, availableLabelValues } =
    useMemo(() => {
      const teams = extractUniqueTeams(timeline);

      // チームフィルタ適用後のアクション一覧
      const actions = new Set<string>();
      const filteredByTeam =
        filterTeam === ALL
          ? timeline
          : timeline.filter(
              (item) =>
                extractTeamFromActionName(item.actionName) === filterTeam,
            );

      for (const item of filteredByTeam) {
        const action = extractActionFromActionName(item.actionName);
        actions.add(action);
      }

      // ラベルグループが指定されている場合、その値を抽出
      const labelValues = new Set<string>();
      if (filterLabelGroup !== ALL) {
        for (const item of timeline) {
          const label = item.labels?.find((l) => l.group === filterLabelGroup);
          if (label) {
            labelValues.add(label.name);
          }
        }
      }

      return {
        availableTeams: teams,
        availableActions: Array.from(actions).sort((a, b) =>
          a.localeCompare(b),
        ),
        availableLabelValues: Array.from(labelValues).sort((a, b) =>
          a.localeCompare(b),
        ),
      };
    }, [timeline, filterTeam, filterLabelGroup]);

  // 適用後のタイムライン
  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      if (filterTeam !== ALL) {
        const team = extractTeamFromActionName(item.actionName);
        if (team !== filterTeam) return false;
      }

      if (filterAction !== ALL) {
        const action = extractActionFromActionName(item.actionName);
        if (action !== filterAction) return false;
      }

      if (filterLabelGroup !== ALL && filterLabelValue !== ALL) {
        const label = item.labels?.find((l) => l.group === filterLabelGroup);
        if (label?.name !== filterLabelValue) return false;
      }

      return true;
    });
  }, [timeline, filterTeam, filterAction, filterLabelGroup, filterLabelValue]);

  // グループ変更時にラベル値をリセット
  useEffect(() => {
    setFilterLabelValue(ALL);
  }, [filterLabelGroup]);

  const clearLabelFilters = () => {
    setFilterLabelGroup(ALL);
    setFilterLabelValue(ALL);
  };

  const clearAllFilters = () => {
    setFilterTeam(ALL);
    setFilterAction(ALL);
    clearLabelFilters();
  };

  const hasActiveFilters =
    filterTeam !== ALL ||
    filterAction !== ALL ||
    (filterLabelGroup !== ALL && filterLabelValue !== ALL);

  return {
    filters: {
      team: filterTeam,
      action: filterAction,
      labelGroup: filterLabelGroup,
      labelValue: filterLabelValue,
    },
    availableTeams,
    availableActions,
    availableLabelValues,
    filteredTimeline,
    hasActiveFilters,
    setFilterTeam,
    setFilterAction,
    setFilterLabelGroup,
    setFilterLabelValue,
    clearLabelFilters,
    clearAllFilters,
  };
};
