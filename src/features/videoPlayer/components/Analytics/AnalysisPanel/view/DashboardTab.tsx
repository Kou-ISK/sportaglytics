import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Divider,
  Stack,
  Typography,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type {
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { useSettings } from '../../../../../../hooks/useSettings';
import {
  extractActionFromActionName,
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
} from '../../../../../../utils/labelExtractors';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { DashboardCard } from './DashboardCard';
import { DashboardWidgetDialog } from './DashboardWidgetDialog';
import { buildCustomChartData } from './hooks/useCustomChartData';
import { CustomBarChart } from './CustomBarChart';
import { CustomPieChart } from './CustomPieChart';
import { getAxisLabel } from './utils';

interface DashboardTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  emptyMessage: string;
}

export const DashboardTab = ({
  hasData,
  timeline,
  teamNames,
  emptyMessage,
}: DashboardTabProps) => {
  const { settings, saveSettings } = useSettings();
  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );
  const availableTeams = useMemo(() => {
    const fromProps = teamNames?.filter(Boolean) ?? [];
    if (fromProps.length > 0) return fromProps;
    return extractUniqueTeams(timeline);
  }, [timeline, teamNames]);
  const availableActions = useMemo(() => {
    const actionSet = new Set<string>();
    for (const item of timeline) {
      const action = extractActionFromActionName(item.actionName);
      if (action) actionSet.add(action);
    }
    return Array.from(actionSet).sort((a, b) => a.localeCompare(b));
  }, [timeline]);
  const availableLabelValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of availableGroups) {
      map[group] = extractUniqueLabelsForGroup(timeline, group);
    }
    return map;
  }, [timeline, availableGroups]);

  const [isEditing, setIsEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<AnalysisDashboardWidget[]>(
    settings.analysisDashboard?.widgets ?? [],
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] =
    useState<AnalysisDashboardWidget | null>(null);
  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});

  const widgets = isEditing
    ? draftWidgets
    : settings.analysisDashboard?.widgets ?? [];

  useEffect(() => {
    if (!isEditing) {
      setDraftWidgets(settings.analysisDashboard?.widgets ?? []);
    }
  }, [isEditing, settings.analysisDashboard]);

  const updateDashboardFilters = (patch: Partial<DashboardSeriesFilter>) => {
    setDashboardFilters((prev) => ({ ...prev, ...patch }));
  };

  const buildFilterChips = (
    prefix: string,
    filters?: DashboardSeriesFilter,
  ): string[] => {
    if (!filters) return [];
    const chips: string[] = [];
    if (filters.team) chips.push(`${prefix} チーム=${filters.team}`);
    if (filters.action) chips.push(`${prefix} アクション=${filters.action}`);
    if (filters.labelGroup) {
      const label = filters.labelValue
        ? `${filters.labelGroup}:${filters.labelValue}`
        : filters.labelGroup;
      chips.push(`${prefix} ラベル=${label}`);
    }
    return chips;
  };

  const handleStartEdit = () => {
    setDraftWidgets(settings.analysisDashboard?.widgets ?? []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftWidgets(settings.analysisDashboard?.widgets ?? []);
    setIsEditing(false);
  };

  const handleSave = async () => {
    await saveSettings({
      ...settings,
      analysisDashboard: {
        widgets: draftWidgets,
      },
    });
    setIsEditing(false);
  };

  const openEditor = (widget?: AnalysisDashboardWidget) => {
    setEditingWidget(widget ?? null);
    setEditorOpen(true);
  };

  const handleEditorSave = (widget: AnalysisDashboardWidget) => {
    setDraftWidgets((prev) => {
      const exists = prev.find((w) => w.id === widget.id);
      if (exists) {
        return prev.map((w) => (w.id === widget.id ? widget : w));
      }
      return [...prev, widget];
    });
    setEditorOpen(false);
  };

  const handleDelete = (id: string) => {
    setDraftWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleDuplicate = (widget: AnalysisDashboardWidget) => {
    setDraftWidgets((prev) => [
      ...prev,
      {
        ...widget,
        id: `${widget.id}-copy-${Date.now()}`,
        title: `${widget.title} (コピー)`,
      },
    ]);
  };

  const handleMove = (id: string, direction: 'up' | 'down') => {
    setDraftWidgets((prev) => {
      const index = prev.findIndex((w) => w.id === id);
      if (index < 0) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  };

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            分析ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
            軸を組み合わせて、必要なグラフを自由に配置できます
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {isEditing && <Chip label="編集モード" color="warning" size="small" />}
          {isEditing ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => openEditor()}
              >
                追加
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                保存
              </Button>
              <IconButton onClick={handleCancelEdit} size="small">
                <CloseIcon />
              </IconButton>
            </>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleStartEdit}
            >
              編集
            </Button>
          )}
        </Stack>
      </Box>

      <Divider />

      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="dashboard-filter-team">チーム</InputLabel>
          <Select
            labelId="dashboard-filter-team"
            value={dashboardFilters.team ?? ''}
            label="チーム"
            onChange={(event) =>
              updateDashboardFilters({ team: event.target.value || undefined })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-filter-action">アクション</InputLabel>
          <Select
            labelId="dashboard-filter-action"
            value={dashboardFilters.action ?? ''}
            label="アクション"
            onChange={(event) =>
              updateDashboardFilters({
                action: event.target.value || undefined,
              })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableActions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-filter-group">ラベルグループ</InputLabel>
          <Select
            labelId="dashboard-filter-group"
            value={dashboardFilters.labelGroup ?? ''}
            label="ラベルグループ"
            onChange={(event) =>
              updateDashboardFilters({
                labelGroup: event.target.value || undefined,
                labelValue: undefined,
              })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {group}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-filter-value">ラベル値</InputLabel>
          <Select
            labelId="dashboard-filter-value"
            value={dashboardFilters.labelValue ?? ''}
            label="ラベル値"
            onChange={(event) =>
              updateDashboardFilters({
                labelValue: event.target.value || undefined,
              })
            }
            disabled={!dashboardFilters.labelGroup}
          >
            <MenuItem value="">指定なし</MenuItem>
            {((dashboardFilters.labelGroup &&
              availableLabelValues[dashboardFilters.labelGroup]) ||
              []).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {widgets.length === 0 && (
        <NoDataPlaceholder message="ダッシュボードに表示するカードを追加してください。" />
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 2,
        }}
      >
        {widgets.map((widget) => {
          const chart = buildCustomChartData(timeline, availableGroups, {
            primaryAxis: widget.primaryAxis,
            seriesAxis: widget.seriesAxis,
            seriesEnabled: widget.seriesEnabled,
            metric: widget.metric,
            limit: widget.limit,
            series: widget.dataMode === 'series' ? widget.series : undefined,
            calc: widget.calc,
            baseFilters: dashboardFilters,
            widgetFilters: widget.widgetFilters,
          });

          const subtitle =
            widget.dataMode === 'series'
              ? '比較シリーズ'
              : `${getAxisLabel(
                  widget.primaryAxis,
                  availableGroups,
                )}${
                  widget.seriesEnabled
                    ? ` × ${getAxisLabel(
                        widget.seriesAxis,
                        availableGroups,
                      )}`
                    : ''
                }`;
          const chips = [
            ...buildFilterChips('全体', dashboardFilters),
            ...buildFilterChips('カード', widget.widgetFilters),
          ];

          return (
            <Box
              key={widget.id}
              sx={{ gridColumn: `span ${widget.colSpan}` }}
            >
              <DashboardCard
                title={widget.title}
                subtitle={subtitle}
                chips={chips}
                actions={
                  isEditing && (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => openEditor(widget)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicate(widget)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleMove(widget.id, 'up')}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleMove(widget.id, 'down')}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(widget.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )
                }
              >
                {chart.data.length === 0 ? (
                  <NoDataPlaceholder message="該当データがありません。" />
                ) : (
                  <>
                    {widget.chartType === 'pie' ? (
                  <CustomPieChart
                        data={chart.data}
                        seriesKeys={chart.seriesKeys}
                        unitLabel={chart.unitLabel}
                        metric={widget.metric}
                        height={300}
                      />
                    ) : (
                      <CustomBarChart
                        data={chart.data}
                        seriesKeys={chart.seriesKeys}
                        stacked={widget.chartType === 'stacked'}
                        showLegend={
                          widget.seriesEnabled && widget.dataMode !== 'series'
                        }
                        unitLabel={chart.unitLabel}
                        metric={widget.metric}
                        height={300}
                      />
                    )}
                  </>
                )}
              </DashboardCard>
            </Box>
          );
        })}
      </Box>

      <DashboardWidgetDialog
        open={editorOpen}
        availableGroups={availableGroups}
        availableTeams={availableTeams}
        availableActions={availableActions}
        availableLabelValues={availableLabelValues}
        initial={editingWidget}
        onSave={handleEditorSave}
        onClose={() => setEditorOpen(false)}
      />
    </Stack>
  );
};
