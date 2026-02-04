import React, { useMemo, useState } from 'react';
import { Stack, Paper, Typography, Box } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixSection } from './MatrixSection';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { MatrixFilters } from './MatrixFilters';
import { useMatrixFilters } from './hooks/useMatrixFilters';
import { useMatrixAxes } from './hooks/useMatrixAxes';
import { FilterSummaryBar } from './FilterSummaryBar';

interface MatrixTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
  emptyMessage: string;
}

export const MatrixTab = ({
  hasData,
  timeline,
  onJumpToSegment,
  emptyMessage,
}: Omit<MatrixTabProps, 'teamNames'>) => {
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
    customRowAxis,
    customColumnAxis,
    setCustomRowAxis,
    setCustomColumnAxis,
  } = useMatrixAxes(availableGroups);

  // フィルタ設定の状態
  const {
    filters,
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
  } = useMatrixFilters(timeline);

  // カスタムマトリクス
  const customMatrix = useMemo(() => {
    return buildHierarchicalMatrix(
      filteredTimeline,
      customRowAxis,
      customColumnAxis,
    );
  }, [filteredTimeline, customRowAxis, customColumnAxis]);

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  // フィルターチップの生成
  const ALL = 'all';
  const filterChips: Array<{ label: string; onDelete: () => void }> = [];
  if (filters.team !== ALL) {
    filterChips.push({
      label: `チーム: ${filters.team}`,
      onDelete: () => setFilterTeam(ALL),
    });
  }
  if (filters.action !== ALL) {
    filterChips.push({
      label: `アクション: ${filters.action}`,
      onDelete: () => setFilterAction(ALL),
    });
  }
  if (filters.labelGroup !== ALL && filters.labelValue !== ALL) {
    filterChips.push({
      label: `${filters.labelGroup}: ${filters.labelValue}`,
      onDelete: clearLabelFilters,
    });
  }

  return (
    <>
      <Stack spacing={1.5}>
        <FilterSummaryBar
          rowAxis={customRowAxis}
          columnAxis={customColumnAxis}
          onRowAxisChange={setCustomRowAxis}
          onColumnAxisChange={setCustomColumnAxis}
          renderAxisEditor={(onClose) => (
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                軸設定
              </Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <MatrixAxisSelector
                  key="row-axis"
                  label="行軸"
                  value={customRowAxis}
                  onChange={(newConfig) => {
                    console.log('行軸 - MatrixTab onChange:', {
                      old: customRowAxis,
                      new: newConfig,
                    });
                    setCustomRowAxis(newConfig);
                  }}
                  availableGroups={availableGroups}
                />
                <MatrixAxisSelector
                  key="column-axis"
                  label="列軸"
                  value={customColumnAxis}
                  onChange={(newConfig) => {
                    console.log('列軸 - MatrixTab onChange:', {
                      old: customColumnAxis,
                      new: newConfig,
                    });
                    setCustomColumnAxis(newConfig);
                  }}
                  availableGroups={availableGroups}
                />
              </Box>
            </Stack>
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
            />
          )}
        />

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
        onJump={(segment) => {
          onJumpToSegment?.(segment);
          setDetail(null);
        }}
      />
    </>
  );
};

/**
 * 軸設定から表示用のラベルを生成
 */
const getAxisLabel = (axis: MatrixAxisConfig): string => {
  switch (axis.type) {
    case 'group':
      return axis.value || 'グループ';
    case 'team':
      return 'チーム';
    case 'action':
      return 'アクション';
    default:
      return '不明';
  }
};
