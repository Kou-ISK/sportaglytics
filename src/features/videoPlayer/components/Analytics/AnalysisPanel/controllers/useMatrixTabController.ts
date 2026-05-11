import { useMemo, useState } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { useMatrixFilters } from './useMatrixFilters';
import { useMatrixAxes } from './useMatrixAxes';
import {
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from './matrixFilterUtils';
import { useMatrixTableExport } from './useMatrixTableExport';
import { buildMatrixFilterChips } from '../utils/matrixFilterChips';
import type { MatrixTabViewProps } from '../components/MatrixTabView';

export interface MatrixTabControllerParams {
  hasData: boolean;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  emptyMessage: string;
  totalTimelineCount?: number;
  matrixAxes?: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  };
  onMatrixAxesChange?: (axes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }) => void;
  matrixFilters?: MatrixFilterState;
  onMatrixFiltersChange?: (filters: MatrixFilterState) => void;
}

export const useMatrixTabController = ({
  hasData,
  timeline,
  onJumpToSegment,
  emptyMessage,
  totalTimelineCount,
  matrixAxes,
  onMatrixAxesChange,
  matrixFilters,
  onMatrixFiltersChange,
}: MatrixTabControllerParams): MatrixTabViewProps => {
  const notification = useNotification();
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);

  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );

  const {
    customRowAxis: localRowAxis,
    customColumnAxis: localColumnAxis,
    setCustomRowAxis: setLocalRowAxis,
    setCustomColumnAxis: setLocalColumnAxis,
  } = useMatrixAxes(availableGroups);

  const {
    filters: localFilters,
    setFilterTeam: setLocalFilterTeam,
    setFilterAction: setLocalFilterAction,
    setFilterLabelGroup: setLocalFilterLabelGroup,
    setFilterLabelValue: setLocalFilterLabelValue,
    clearLabelFilters: clearLocalLabelFilters,
  } = useMatrixFilters(timeline);

  const customRowAxis = matrixAxes?.row ?? localRowAxis;
  const customColumnAxis = matrixAxes?.column ?? localColumnAxis;
  const filters = matrixFilters ?? localFilters;
  const {
    availableTeams,
    availableActions,
    availableLabelValues,
    filteredTimeline,
    hasActiveFilters,
  } = useMemo(
    () => deriveMatrixFilters(timeline, filters),
    [timeline, filters],
  );

  const setCustomRowAxis = (next: MatrixAxisConfig): void => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: next, column: customColumnAxis });
      return;
    }

    setLocalRowAxis(next);
  };

  const setCustomColumnAxis = (next: MatrixAxisConfig): void => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: customRowAxis, column: next });
      return;
    }

    setLocalColumnAxis(next);
  };

  const setFilterTeam = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, team: value });
      return;
    }

    setLocalFilterTeam(value);
  };

  const setFilterAction = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, action: value });
      return;
    }

    setLocalFilterAction(value);
  };

  const setFilterLabelGroup = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({
        ...filters,
        labelGroup: value,
        labelValue: MATRIX_FILTER_ALL,
      });
      return;
    }

    setLocalFilterLabelGroup(value);
  };

  const setFilterLabelValue = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, labelValue: value });
      return;
    }

    setLocalFilterLabelValue(value);
  };

  const clearLabelFilters = (): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({
        ...filters,
        labelGroup: MATRIX_FILTER_ALL,
        labelValue: MATRIX_FILTER_ALL,
      });
      return;
    }

    clearLocalLabelFilters();
  };

  const customMatrix = useMemo(() => {
    return buildHierarchicalMatrix(
      filteredTimeline,
      customRowAxis,
      customColumnAxis,
    );
  }, [filteredTimeline, customRowAxis, customColumnAxis]);

  const { exportMatrix } = useMatrixTableExport({
    customMatrix,
    customRowAxis,
    customColumnAxis,
    notification,
  });

  const allFilterValue = MATRIX_FILTER_ALL;
  const filterChips = buildMatrixFilterChips({
    filters,
    onResetTeam: () => setFilterTeam(allFilterValue),
    onResetAction: () => setFilterAction(allFilterValue),
    onResetLabels: clearLabelFilters,
  });

  const filterCount = Object.values(filters).filter(
    (value) => value !== '' && value !== allFilterValue,
  ).length;

  return {
    hasData,
    emptyMessage,
    totalTimelineCount,
    filteredTimelineCount: filteredTimeline.length,
    timelineCount: timeline.length,
    availableGroups,
    availableTeams,
    availableActions,
    availableLabelValues,
    customRowAxis,
    customColumnAxis,
    filters,
    hasActiveFilters,
    filterCount,
    filterChips,
    customMatrix,
    detail,
    onRowAxisChange: setCustomRowAxis,
    onColumnAxisChange: setCustomColumnAxis,
    onTeamChange: setFilterTeam,
    onActionChange: setFilterAction,
    onLabelGroupChange: setFilterLabelGroup,
    onLabelValueChange: setFilterLabelValue,
    onClearLabelFilters: clearLabelFilters,
    onExportMatrix: exportMatrix,
    onDrilldown: (title, entries) => {
      setDetail({ title, entries });
    },
    onDetailClose: () => {
      setDetail(null);
    },
    onJumpToSegment,
  };
};
