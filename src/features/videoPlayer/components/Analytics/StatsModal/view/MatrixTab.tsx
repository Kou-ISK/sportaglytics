import React, { useMemo, useState } from 'react';
import { Stack, Paper, Typography, Divider, Box } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixSection } from './MatrixSection';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import {
  extractUniqueGroups,
} from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { MatrixFilters } from './MatrixFilters';
import { useMatrixFilters } from './hooks/useMatrixFilters';
import { useMatrixAxes } from './hooks/useMatrixAxes';

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

  return (
    <>
      <Stack spacing={3}>
        {/* カスタム分析 */}
        <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* ヘッダー */}
            <Box display="flex" alignItems="center" gap={1}>
              <SettingsIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                カスタム分析
              </Typography>
            </Box>

            <Divider />

            {/* 軸設定 */}
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
              <Box>
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
              </Box>
              <Box>
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
            </Box>

            {/* フィルタ設定 */}
            <Divider />
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

            {/* マトリクス表示 */}
            {customMatrix && customMatrix.rowHeaders.length > 0 && (
              <>
                <Divider />
                <MatrixSection
                  title={`${getAxisLabel(customRowAxis)} × ${getAxisLabel(customColumnAxis)}`}
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
