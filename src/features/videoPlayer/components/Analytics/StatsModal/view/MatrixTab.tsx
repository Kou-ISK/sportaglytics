import React, { useMemo, useState } from 'react';
import { Stack, Paper, Typography, Divider, Box, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixSection } from './MatrixSection';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';

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
  teamNames,
  onJumpToSegment,
  emptyMessage,
}: MatrixTabProps) => {
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
  const [showCustomConfig, setShowCustomConfig] = useState(false);
  const [customRowAxis, setCustomRowAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: 'actionType',
  });
  const [customColumnAxis, setCustomColumnAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: 'actionResult',
  });

  // デフォルトのマトリクス（actionType × actionResult）
  const defaultMatrix = useMemo(() => {
    const rowAxis: MatrixAxisConfig = { type: 'group', value: 'actionType' };
    const columnAxis: MatrixAxisConfig = {
      type: 'group',
      value: 'actionResult',
    };
    return buildHierarchicalMatrix(timeline, rowAxis, columnAxis);
  }, [timeline]);

  // カスタムマトリクス
  const customMatrix = useMemo(() => {
    if (!showCustomConfig) return null;
    return buildHierarchicalMatrix(timeline, customRowAxis, customColumnAxis);
  }, [timeline, customRowAxis, customColumnAxis, showCustomConfig]);

  // チーム別のマトリクス（action × group）
  const teamMatrices = useMemo(() => {
    const matrices = new Map<
      string,
      {
        byType: ReturnType<typeof buildHierarchicalMatrix>;
        byResult: ReturnType<typeof buildHierarchicalMatrix>;
      }
    >();

    for (const team of teamNames) {
      const byType = buildHierarchicalMatrix(
        timeline,
        { type: 'action' },
        { type: 'group', value: 'actionType' },
      );

      const byResult = buildHierarchicalMatrix(
        timeline,
        { type: 'action' },
        { type: 'group', value: 'actionResult' },
      );

      if (byType.rowHeaders.length > 0 || byResult.rowHeaders.length > 0) {
        matrices.set(team, { byType, byResult });
      }
    }

    return matrices;
  }, [teamNames, timeline]);

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <>
      <Stack spacing={4}>
        {/* デフォルトマトリクス */}
        <MatrixSection
          title="アクション種別 × アクション結果"
          rowHeaders={defaultMatrix.rowHeaders}
          columnHeaders={defaultMatrix.columnHeaders}
          rowParentSpans={defaultMatrix.rowParentSpans}
          colParentSpans={defaultMatrix.colParentSpans}
          matrix={defaultMatrix.matrix}
          onDrilldown={(title, entries) => setDetail({ title, entries })}
        />

        {/* カスタムマトリクス設定 */}
        <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <SettingsIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                カスタム分析
              </Typography>
              <Button
                size="small"
                onClick={() => setShowCustomConfig(!showCustomConfig)}
                sx={{ ml: 'auto' }}
              >
                {showCustomConfig ? '非表示' : '表示'}
              </Button>
            </Box>

            {showCustomConfig && (
              <>
                <Divider />
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                  <MatrixAxisSelector
                    label="行軸"
                    value={customRowAxis}
                    onChange={setCustomRowAxis}
                    availableGroups={availableGroups}
                  />
                  <MatrixAxisSelector
                    label="列軸"
                    value={customColumnAxis}
                    onChange={setCustomColumnAxis}
                    availableGroups={availableGroups}
                  />
                </Box>

                {customMatrix && (
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
                  </>
                )}
              </>
            )}
          </Stack>
        </Paper>

        {/* チーム別マトリクス */}
        {Array.from(teamMatrices.entries()).map(([team, matrices]) => (
          <Stack key={team} spacing={3}>
            {matrices.byType.rowHeaders.length > 0 && (
              <MatrixSection
                title={`${team} - アクション × アクション種別`}
                rowHeaders={matrices.byType.rowHeaders}
                columnHeaders={matrices.byType.columnHeaders}
                rowParentSpans={matrices.byType.rowParentSpans}
                colParentSpans={matrices.byType.colParentSpans}
                matrix={matrices.byType.matrix}
                onDrilldown={(title, entries) => setDetail({ title, entries })}
              />
            )}
            {matrices.byResult.rowHeaders.length > 0 && (
              <MatrixSection
                title={`${team} - アクション × アクション結果`}
                rowHeaders={matrices.byResult.rowHeaders}
                columnHeaders={matrices.byResult.columnHeaders}
                rowParentSpans={matrices.byResult.rowParentSpans}
                colParentSpans={matrices.byResult.colParentSpans}
                matrix={matrices.byResult.matrix}
                onDrilldown={(title, entries) => setDetail({ title, entries })}
              />
            )}
          </Stack>
        ))}
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
