import React, { useMemo, useState } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { useMatrixFilters } from '../controllers/useMatrixFilters';
import { useMatrixAxes } from '../controllers/useMatrixAxes';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from '../controllers/matrixFilterUtils';
import { useMatrixTableExport } from '../controllers/useMatrixTableExport';
import { buildMatrixFilterChips } from '../utils/matrixFilterChips';
import { MatrixTabView } from './MatrixTabView';

interface MatrixTabProps {
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

export const MatrixTab = ({
  hasData,
  timeline,
  onJumpToSegment,
  emptyMessage,
  totalTimelineCount,
  matrixAxes,
  onMatrixAxesChange,
  matrixFilters,
  onMatrixFiltersChange,
}: MatrixTabProps) => {
  const notification = useNotification();
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);

  // 利用可能なグループを抽出
  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );

  // カスタム軸設定の状態
  const {
    customRowAxis: localRowAxis,
    customColumnAxis: localColumnAxis,
    setCustomRowAxis: setLocalRowAxis,
    setCustomColumnAxis: setLocalColumnAxis,
  } = useMatrixAxes(availableGroups);

  // フィルタ設定の状態
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
  } = useMemo(() => deriveMatrixFilters(timeline, filters), [timeline, filters]);

  const setCustomRowAxis = (next: MatrixAxisConfig) => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: next, column: customColumnAxis });
    } else {
      setLocalRowAxis(next);
    }
  };

  const setCustomColumnAxis = (next: MatrixAxisConfig) => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: customRowAxis, column: next });
    } else {
      setLocalColumnAxis(next);
    }
  };

  const setFilterTeam = (value: string) => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, team: value });
    } else {
      setLocalFilterTeam(value);
    }
  };

  const setFilterAction = (value: string) => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, action: value });
    } else {
      setLocalFilterAction(value);
    }
  };

  const setFilterLabelGroup = (value: string) => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({
        ...filters,
        labelGroup: value,
        labelValue: MATRIX_FILTER_ALL,
      });
    } else {
      setLocalFilterLabelGroup(value);
    }
  };

  const setFilterLabelValue = (value: string) => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, labelValue: value });
    } else {
      setLocalFilterLabelValue(value);
    }
  };

  const clearLabelFilters = () => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({
        ...filters,
        labelGroup: MATRIX_FILTER_ALL,
        labelValue: MATRIX_FILTER_ALL,
      });
    } else {
      clearLocalLabelFilters();
    }
  };

  // カスタムマトリクス
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

  // フィルターチップの生成
  const ALL = MATRIX_FILTER_ALL;
  const filterChips = buildMatrixFilterChips({
    filters,
    onResetTeam: () => setFilterTeam(ALL),
    onResetAction: () => setFilterAction(ALL),
    onResetLabels: clearLabelFilters,
  });

  return (
    <MatrixTabView
      hasData={hasData}
      emptyMessage={emptyMessage}
      totalTimelineCount={totalTimelineCount}
      filteredTimelineCount={filteredTimeline.length}
      timelineCount={timeline.length}
      availableGroups={availableGroups}
      availableTeams={availableTeams}
      availableActions={availableActions}
      availableLabelValues={availableLabelValues}
      customRowAxis={customRowAxis}
      customColumnAxis={customColumnAxis}
      filters={filters}
      hasActiveFilters={hasActiveFilters}
      filterCount={
        Object.values(filters).filter((value) => value !== '' && value !== ALL)
          .length
      }
      filterChips={filterChips}
      customMatrix={customMatrix}
      detail={detail}
      onRowAxisChange={setCustomRowAxis}
      onColumnAxisChange={setCustomColumnAxis}
      onTeamChange={setFilterTeam}
      onActionChange={setFilterAction}
      onLabelGroupChange={setFilterLabelGroup}
      onLabelValueChange={setFilterLabelValue}
      onClearLabelFilters={clearLabelFilters}
      onExportMatrix={exportMatrix}
      onDrilldown={(title, entries) => {
        setDetail({ title, entries });
      }}
      onDetailClose={() => {
        setDetail(null);
      }}
      onJumpToSegment={onJumpToSegment}
    />
  );
};
