import React from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { MatrixAxisEditor } from './MatrixAxisEditor';
import { DrilldownDialog } from './DrilldownDialog';
import { FilterSummaryBar } from './FilterSummaryBar';
import { MatrixFilters } from './MatrixFilters';
import { MatrixSection } from './MatrixSection';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import type { MatrixFilterState } from '../controllers/matrixFilterUtils';

export interface MatrixTabViewProps {
  hasData: boolean;
  emptyMessage: string;
  totalTimelineCount?: number;
  filteredTimelineCount: number;
  timelineCount: number;
  availableGroups: string[];
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: string[];
  customRowAxis: MatrixAxisConfig;
  customColumnAxis: MatrixAxisConfig;
  filters: MatrixFilterState;
  hasActiveFilters: boolean;
  filterCount: number;
  filterChips: Array<{ label: string; onDelete: () => void }>;
  customMatrix: ReturnType<typeof buildHierarchicalMatrix>;
  detail: {
    title: string;
    entries: TimelineData[];
  } | null;
  onRowAxisChange: (value: MatrixAxisConfig) => void;
  onColumnAxisChange: (value: MatrixAxisConfig) => void;
  onTeamChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onLabelGroupChange: (value: string) => void;
  onLabelValueChange: (value: string) => void;
  onClearLabelFilters: () => void;
  onExportMatrix: (format: 'csv' | 'xlsx') => Promise<void>;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
  onDetailClose: () => void;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const MatrixTabView = ({
  hasData,
  emptyMessage,
  totalTimelineCount,
  filteredTimelineCount,
  timelineCount,
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
  onRowAxisChange,
  onColumnAxisChange,
  onTeamChange,
  onActionChange,
  onLabelGroupChange,
  onLabelValueChange,
  onClearLabelFilters,
  onExportMatrix,
  onDrilldown,
  onDetailClose,
  onJumpToSegment,
}: MatrixTabViewProps) => {
  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <>
      <Stack spacing={1.5}>
        <FilterSummaryBar
          rowAxis={customRowAxis}
          columnAxis={customColumnAxis}
          onRowAxisChange={onRowAxisChange}
          onColumnAxisChange={onColumnAxisChange}
          renderAxisEditor={() => (
            <MatrixAxisEditor
              rowAxis={customRowAxis}
              columnAxis={customColumnAxis}
              availableGroups={availableGroups}
              onRowAxisChange={onRowAxisChange}
              onColumnAxisChange={onColumnAxisChange}
            />
          )}
          hasActiveFilters={hasActiveFilters}
          filterCount={filterCount}
          filterChips={filterChips}
          renderFilterEditor={(onClose) => (
            <MatrixFilters
              filters={filters}
              availableTeams={availableTeams}
              availableActions={availableActions}
              availableLabelValues={availableLabelValues}
              availableGroups={availableGroups}
              onTeamChange={onTeamChange}
              onActionChange={onActionChange}
              onLabelGroupChange={onLabelGroupChange}
              onLabelValueChange={onLabelValueChange}
              onClearLabelFilters={onClearLabelFilters}
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
            onClick={() => void onExportMatrix('csv')}
          >
            この表をCSVで保存
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void onExportMatrix('xlsx')}
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
                  onDrilldown={onDrilldown}
                />
                <Typography variant="caption" color="text.secondary">
                  対象データ数: {filteredTimelineCount} / {timelineCount}
                  {typeof totalTimelineCount === 'number' &&
                    totalTimelineCount > timelineCount && (
                      <>（全体: {timelineCount}/{totalTimelineCount}）</>
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
        onClose={onDetailClose}
        onJump={(segment) => onJumpToSegment?.(segment)}
      />
    </>
  );
};
