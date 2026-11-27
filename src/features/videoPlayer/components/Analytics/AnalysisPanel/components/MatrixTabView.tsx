import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';
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
  availableActionsByTeam: Record<string, string[]>;
  availableLabelValuesByGroup: Record<string, string[]>;
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
  onFiltersApply: (filters: MatrixFilterState) => void;
  onExportMatrix: (format: 'csv' | 'xlsx') => Promise<void>;
  onCreateDetailPlaylist: (
    title: string,
    entries: TimelineData[],
  ) => Promise<void>;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
  onDetailClose: () => void;
  onReviewInstances?: (items: TimelineData[]) => void;
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
  availableActionsByTeam,
  availableLabelValuesByGroup,
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
  onFiltersApply,
  onExportMatrix,
  onCreateDetailPlaylist,
  onDrilldown,
  onDetailClose,
  onReviewInstances,
  onJumpToSegment,
}: MatrixTabViewProps) => {
  const [selection, setSelected] = useState<{
    matrix: MatrixTabViewProps['customMatrix'];
    title: string;
    entries: TimelineData[];
  } | null>(null);
  const selected = selection?.matrix === customMatrix ? selection : null;
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <>
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
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
              availableActionsByTeam={availableActionsByTeam}
              availableLabelValuesByGroup={availableLabelValuesByGroup}
              availableGroups={availableGroups}
              onFiltersApply={onFiltersApply}
              hasActiveFilters={hasActiveFilters}
              onApply={onClose}
              onClose={onClose}
            />
          )}
        />

        <Box
          display="flex"
          justifyContent="flex-end"
          gap={1}
          sx={{ flexWrap: 'wrap' }}
        >
          {onReviewInstances && (
            <Button
              size="small"
              disabled={!selected}
              onClick={() => {
                if (selected) onDrilldown(selected.title, selected.entries);
              }}
            >
              場面一覧
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            aria-haspopup="menu"
            aria-expanded={Boolean(exportMenu)}
            onClick={(event) => setExportMenu(event.currentTarget)}
          >
            表を書き出す
          </Button>
          <Menu
            anchorEl={exportMenu}
            open={Boolean(exportMenu)}
            onClose={() => setExportMenu(null)}
          >
            <MenuItem
              onClick={() => {
                setExportMenu(null);
                void onExportMatrix('csv');
              }}
            >
              CSVで保存
            </MenuItem>
            <MenuItem
              onClick={() => {
                setExportMenu(null);
                void onExportMatrix('xlsx');
              }}
            >
              XLSXで保存
            </MenuItem>
          </Menu>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            {customMatrix && customMatrix.rowHeaders.length > 0 && (
              <>
                <MatrixSection
                  rowHeaders={customMatrix.rowHeaders}
                  columnHeaders={customMatrix.columnHeaders}
                  rowParentSpans={customMatrix.rowParentSpans}
                  colParentSpans={customMatrix.colParentSpans}
                  matrix={customMatrix.matrix}
                  onSelectForReview={(title, entries) =>
                    setSelected({ matrix: customMatrix, title, entries })
                  }
                  onReviewInstances={
                    onReviewInstances
                      ? (items) => {
                          const unique = [
                            ...new Map(
                              items.map((item) => [item.id, item]),
                            ).values(),
                          ];
                          onReviewInstances(
                            unique.sort((a, b) => a.startTime - b.startTime),
                          );
                        }
                      : undefined
                  }
                  onDrilldown={onDrilldown}
                />
                <Typography variant="caption" color="text.secondary">
                  対象データ数: {filteredTimelineCount} / {timelineCount}
                  {typeof totalTimelineCount === 'number' &&
                    totalTimelineCount > timelineCount && (
                      <>
                        （全体: {timelineCount}/{totalTimelineCount}）
                      </>
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
        onCreatePlaylist={onCreateDetailPlaylist}
      />
    </>
  );
};
