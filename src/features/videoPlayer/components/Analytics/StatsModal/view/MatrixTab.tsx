import React, { useMemo, useState } from 'react';
import {
  Stack,
  Paper,
  Typography,
  Divider,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixSection } from './MatrixSection';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import {
  extractUniqueGroups,
  extractUniqueTeams,
  extractActionFromActionName,
  extractTeamFromActionName,
} from '../../../../../../utils/labelExtractors';
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

  // カスタム軸設定の初期値を計算
  const initialRowValue = React.useMemo(() => {
    if (availableGroups.length === 0) return '';
    return availableGroups.includes('actionType')
      ? 'actionType'
      : availableGroups[0];
  }, [availableGroups]);

  const initialColValue = React.useMemo(() => {
    if (availableGroups.length === 0) return '';
    return availableGroups.includes('actionResult')
      ? 'actionResult'
      : availableGroups.length > 1
        ? availableGroups[1]
        : availableGroups[0];
  }, [availableGroups]);

  // カスタム軸設定の状態
  const [customRowAxis, setCustomRowAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: initialRowValue,
  });
  const [customColumnAxis, setCustomColumnAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: initialColValue,
  });

  // availableGroupsが変更されたら、軸の値を更新
  React.useEffect(() => {
    if (availableGroups.length > 0) {
      setCustomRowAxis((prev) => ({
        ...prev,
        value: initialRowValue,
      }));
      setCustomColumnAxis((prev) => ({
        ...prev,
        value: initialColValue,
      }));
    }
  }, [initialRowValue, initialColValue, availableGroups.length]);

  // フィルタ設定の状態
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterLabelGroup, setFilterLabelGroup] = useState<string>('all');
  const [filterLabelValue, setFilterLabelValue] = useState<string>('all');

  // 利用可能なチーム、アクション、ラベル値を抽出
  const { availableTeams, availableActions, availableLabelValues } =
    useMemo(() => {
      const teams = extractUniqueTeams(timeline);

      // チームフィルタが適用されている場合はそのチームのアクションのみ
      const actions = new Set<string>();
      const filteredByTeam =
        filterTeam === 'all'
          ? timeline
          : timeline.filter(
              (item) =>
                extractTeamFromActionName(item.actionName) === filterTeam,
            );

      for (const item of filteredByTeam) {
        const action = extractActionFromActionName(item.actionName);
        actions.add(action);
      }

      // ラベルグループが選択されている場合、そのグループの値を抽出
      const labelValues = new Set<string>();
      if (filterLabelGroup !== 'all') {
        for (const item of timeline) {
          const label = item.labels?.find((l) => l.group === filterLabelGroup);
          if (label) {
            labelValues.add(label.name);
          }
        }
      }

      return {
        availableTeams: teams,
        availableActions: Array.from(actions).sort((a, b) =>
          a.localeCompare(b),
        ),
        availableLabelValues: Array.from(labelValues).sort((a, b) =>
          a.localeCompare(b),
        ),
      };
    }, [timeline, filterTeam, filterLabelGroup]);

  // フィルタリングされたタイムライン
  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      // チームフィルタ
      if (filterTeam !== 'all') {
        const team = extractTeamFromActionName(item.actionName);
        if (team !== filterTeam) return false;
      }

      // アクションフィルタ
      if (filterAction !== 'all') {
        const action = extractActionFromActionName(item.actionName);
        if (action !== filterAction) return false;
      }

      // ラベルフィルタ
      if (filterLabelGroup !== 'all' && filterLabelValue !== 'all') {
        const label = item.labels?.find((l) => l.group === filterLabelGroup);
        if (label?.name !== filterLabelValue) return false;
      }

      return true;
    });
  }, [timeline, filterTeam, filterAction, filterLabelGroup, filterLabelValue]);

  // カスタムマトリクス
  const customMatrix = useMemo(() => {
    return buildHierarchicalMatrix(
      filteredTimeline,
      customRowAxis,
      customColumnAxis,
    );
  }, [filteredTimeline, customRowAxis, customColumnAxis]);

  // ラベルグループが変更されたらラベル値をリセット
  React.useEffect(() => {
    setFilterLabelValue('all');
  }, [filterLabelGroup]);

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
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              フィルタ
            </Typography>
            <Box display="grid" gridTemplateColumns="1fr 1fr 1fr 1fr" gap={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>チーム</InputLabel>
                <Select
                  value={filterTeam}
                  label="チーム"
                  onChange={(e) => setFilterTeam(e.target.value)}
                >
                  <MenuItem value="all">全て</MenuItem>
                  {availableTeams.map((team) => (
                    <MenuItem key={team} value={team}>
                      {team}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>アクション</InputLabel>
                <Select
                  value={filterAction}
                  label="アクション"
                  onChange={(e) => setFilterAction(e.target.value)}
                  disabled={availableActions.length === 0}
                >
                  <MenuItem value="all">全て</MenuItem>
                  {availableActions.map((action) => (
                    <MenuItem key={action} value={action}>
                      {action}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>ラベルグループ</InputLabel>
                <Select
                  value={filterLabelGroup}
                  label="ラベルグループ"
                  onChange={(e) => setFilterLabelGroup(e.target.value)}
                >
                  <MenuItem value="all">全て</MenuItem>
                  {availableGroups.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>ラベル値</InputLabel>
                <Select
                  value={filterLabelValue}
                  label="ラベル値"
                  onChange={(e) => setFilterLabelValue(e.target.value)}
                  disabled={
                    filterLabelGroup === 'all' ||
                    availableLabelValues.length === 0
                  }
                >
                  <MenuItem value="all">全て</MenuItem>
                  {availableLabelValues.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* フィルタ適用状況 */}
            {(filterTeam !== 'all' ||
              filterAction !== 'all' ||
              (filterLabelGroup !== 'all' && filterLabelValue !== 'all')) && (
              <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  適用中:
                </Typography>
                {filterTeam !== 'all' && (
                  <Chip
                    label={`チーム: ${filterTeam}`}
                    size="small"
                    onDelete={() => setFilterTeam('all')}
                  />
                )}
                {filterAction !== 'all' && (
                  <Chip
                    label={`アクション: ${filterAction}`}
                    size="small"
                    onDelete={() => setFilterAction('all')}
                  />
                )}
                {filterLabelGroup !== 'all' && filterLabelValue !== 'all' && (
                  <Chip
                    label={`${filterLabelGroup}: ${filterLabelValue}`}
                    size="small"
                    onDelete={() => {
                      setFilterLabelGroup('all');
                      setFilterLabelValue('all');
                    }}
                  />
                )}
              </Box>
            )}

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
