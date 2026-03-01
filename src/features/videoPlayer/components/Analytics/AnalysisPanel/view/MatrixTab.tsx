import React, { useMemo, useState } from 'react';
import { Stack, Paper, Typography, Box, Button } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixSection } from './MatrixSection';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { MatrixFilters } from './MatrixFilters';
import { useMatrixFilters } from './hooks/useMatrixFilters';
import { useMatrixAxes } from './hooks/useMatrixAxes';
import { FilterSummaryBar } from './FilterSummaryBar';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from './hooks/matrixFilterUtils';
import { useMatrixTableExport } from './hooks/useMatrixTableExport';
import { buildMatrixFilterChips } from './utils/matrixFilterChips';
import { MatrixAxisEditor } from './MatrixAxisEditor';

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

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  // フィルターチップの生成
  const ALL = MATRIX_FILTER_ALL;
  const filterChips = buildMatrixFilterChips({
    filters,
    onResetTeam: () => setFilterTeam(ALL),
    onResetAction: () => setFilterAction(ALL),
    onResetLabels: clearLabelFilters,
  });

  return (
    <>
      <Stack spacing={1.5}>
        <FilterSummaryBar
          rowAxis={customRowAxis}
          columnAxis={customColumnAxis}
          onRowAxisChange={setCustomRowAxis}
          onColumnAxisChange={setCustomColumnAxis}
          renderAxisEditor={() => (
            <MatrixAxisEditor
              rowAxis={customRowAxis}
              columnAxis={customColumnAxis}
              availableGroups={availableGroups}
              onRowAxisChange={setCustomRowAxis}
              onColumnAxisChange={setCustomColumnAxis}
            />
          )}
          hasActiveFilters={hasActiveFilters}
          filterCount={
            Object.values(filters).filter((v) => v !== '' && v !== ALL).length
          }
          filterChips={filterChips}
          renderFilterEditor={(onClose) => (
            <MatrixFilters
              filters={filters}
              availableTeams={availableTeams}
              availableActions={availableActions}
              availableLabelValues={availableLabelValues}
              availableGroups={availableGroups}
              onTeamChange={setFilterTeam}
              onActionChange={setFilterAction}
              onLabelGroupChange={setFilterLabelGroup}
              onLabelValueChange={setFilterLabelValue}
              onClearLabelFilters={clearLabelFilters}
              hasActiveFilters={hasActiveFilters}
              onApply={onClose}
              onClose={onClose}
            />
          )}
        />

        <Box display="flex" justifyContent="flex-end" gap={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void exportMatrix('csv')}
          >
            この表をCSVで保存
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void exportMatrix('xlsx')}
          >
            この表をXLSXで保存
          </Button>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={1}>
            {customMatrix && customMatrix.rowHeaders.length > 0 && (
              <>
                <MatrixSection
                  rowHeaders={customMatrix.rowHeaders}
                  columnHeaders={customMatrix.columnHeaders}
                  rowParentSpans={customMatrix.rowParentSpans}
                  colParentSpans={customMatrix.colParentSpans}
                  matrix={customMatrix.matrix}
                  onDrilldown={(title, entries) =>
                    setDetail({ title, entries })
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  対象データ数: {filteredTimeline.length} / {timeline.length}
                  {typeof totalTimelineCount === 'number' &&
                    totalTimelineCount > timeline.length && (
                      <>（全体: {timeline.length}/{totalTimelineCount}）</>
                    )}
                </Typography>
              </>
            )}

            {customMatrix?.rowHeaders.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  フィルタ条件に一致するデータがありません
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Stack>

      <DrilldownDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onJump={(segment) => onJumpToSegment?.(segment)}
      />
    </>
  );
};
