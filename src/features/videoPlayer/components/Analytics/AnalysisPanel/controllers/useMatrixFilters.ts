import { useEffect, useMemo, useState } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import {
  createDefaultMatrixFilters,
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from './matrixFilterUtils';

export type { MatrixFilterState } from './matrixFilterUtils';

interface MatrixFiltersResult {
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
  const [filters, setFilters] = useState<MatrixFilterState>(
    createDefaultMatrixFilters(),
  );

  const derived = useMemo(
    () => deriveMatrixFilters(timeline, filters),
    [timeline, filters],
  );

  useEffect(() => {
    setFilters((prev) => {
      if (prev.labelValue === MATRIX_FILTER_ALL) return prev;
      return { ...prev, labelValue: MATRIX_FILTER_ALL };
    });
  }, [filters.labelGroup]);

  const setFilterTeam = (value: string) => {
    setFilters((prev) => ({ ...prev, team: value }));
  };

  const setFilterAction = (value: string) => {
    setFilters((prev) => ({ ...prev, action: value }));
  };

  const setFilterLabelGroup = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      labelGroup: value,
      labelValue: MATRIX_FILTER_ALL,
    }));
  };

  const setFilterLabelValue = (value: string) => {
    setFilters((prev) => ({ ...prev, labelValue: value }));
  };

  const clearLabelFilters = () => {
    setFilters((prev) => ({
      ...prev,
      labelGroup: MATRIX_FILTER_ALL,
      labelValue: MATRIX_FILTER_ALL,
    }));
  };

  const clearAllFilters = () => {
    setFilters(createDefaultMatrixFilters());
  };

  return {
    filters,
    ...derived,
    setFilterTeam,
    setFilterAction,
    setFilterLabelGroup,
    setFilterLabelValue,
    clearLabelFilters,
    clearAllFilters,
  };
};
