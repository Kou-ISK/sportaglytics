import React, { useMemo, useState } from 'react';
import { Stack, Paper, Typography, Box, Button } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
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
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  buildMatrixCsv,
  buildMatrixExportAoa,
  buildMatrixXlsxBase64,
} from '../../../../../../utils/matrixExport';

interface MatrixTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  emptyMessage: string;
  totalTimelineCount?: number;
}

export const MatrixTab = ({
  hasData,
  timeline,
  onJumpToSegment,
  emptyMessage,
  totalTimelineCount,
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

  const axisToken = (value: string | undefined) =>
    (value || '-')
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

  const exportMatrix = async (format: 'csv' | 'xlsx') => {
    const api = globalThis.window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeTextFile || !api?.writeBinaryFile) {
      notification.error('エクスポート機能が利用できません。');
      return;
    }

    if (!customMatrix || customMatrix.rowHeaders.length === 0) {
      notification.warning('エクスポート対象のクロス集計データがありません。');
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const rowToken = `${customRowAxis.type}-${axisToken(customRowAxis.value)}`;
    const colToken = `${customColumnAxis.type}-${axisToken(customColumnAxis.value)}`;
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const defaultName = `matrix-${rowToken}-${colToken}-${date}.${extension}`;
    const filterName = format === 'csv' ? 'CSV' : 'Excel';

    const filePath = await api.saveFileDialog(defaultName, [
      { name: filterName, extensions: [extension] },
    ]);

    if (!filePath) return;

    const aoa = buildMatrixExportAoa({
      meta: {
        exportedAtIso: new Date().toISOString(),
        rowAxis: customRowAxis,
        columnAxis: customColumnAxis,
        filters,
        visibleCount: filteredTimeline.length,
        totalCount: timeline.length,
      },
      table: {
        rowHeaders: customMatrix.rowHeaders,
        columnHeaders: customMatrix.columnHeaders,
        matrix: customMatrix.matrix,
      },
    });

    if (format === 'csv') {
      const csv = buildMatrixCsv(aoa);
      const ok = await api.writeTextFile(filePath, csv);
      if (ok) {
        notification.success('クロス集計CSVを保存しました。');
      } else {
        notification.error('クロス集計CSVの保存に失敗しました。');
      }
      return;
    }

    const xlsxBase64 = buildMatrixXlsxBase64(aoa, 'Matrix');
    const ok = await api.writeBinaryFile(filePath, xlsxBase64);
    if (ok) {
      notification.success('クロス集計XLSXを保存しました。');
    } else {
      notification.error('クロス集計XLSXの保存に失敗しました。');
    }
  };

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
  } else if (filters.labelGroup !== ALL) {
    filterChips.push({
      label: `ラベルグループ: ${filters.labelGroup}`,
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
          renderAxisEditor={() => (
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
                    setCustomRowAxis(newConfig);
                  }}
                  availableGroups={availableGroups}
                />
                <MatrixAxisSelector
                  key="column-axis"
                  label="列軸"
                  value={customColumnAxis}
                  onChange={(newConfig) => {
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
            CSVエクスポート
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void exportMatrix('xlsx')}
          >
            XLSXエクスポート
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
