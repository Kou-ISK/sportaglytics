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
  Paper,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DashboardIcon from '@mui/icons-material/Dashboard';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { useSettings } from '../../../../../../hooks/useSettings';
import { useNotification } from '../../../../../../contexts/NotificationContext';
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

const ACTIONS_TO_SUMMARISE: ReadonlyArray<string> = [
  'スクラム',
  'ラインアウト',
  'キック',
  'FK',
  'PK',
];

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
  const notification = useNotification();
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
  const [draftWidgets, setDraftWidgets] = useState<AnalysisDashboardWidget[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] =
    useState<AnalysisDashboardWidget | null>(null);
  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [dashboardMenuAnchor, setDashboardMenuAnchor] =
    useState<null | HTMLElement>(null);
  const dashboards = settings.analysisDashboard?.dashboards ?? [];
  const activeDashboardId =
    settings.analysisDashboard?.activeDashboardId ?? dashboards[0]?.id ?? '';
  const activeDashboard =
    dashboards.find((item) => item.id === activeDashboardId) ?? dashboards[0];
  const activeDashboardWidgets = activeDashboard?.widgets ?? [];

  const widgets = isEditing ? draftWidgets : activeDashboardWidgets;

  useEffect(() => {
    if (!isEditing) {
      setDraftWidgets(activeDashboardWidgets);
    }
  }, [isEditing, activeDashboardWidgets]);

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
  const appliedFilterChips = useMemo(
    () => buildFilterChips('全体', dashboardFilters),
    [dashboardFilters],
  );

  const generateDashboardId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const generateWidgetId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const saveDashboards = async (
    nextDashboards: AnalysisDashboard[],
    nextActiveId: string,
  ) => {
    await saveSettings({
      ...settings,
      analysisDashboard: {
        dashboards: nextDashboards,
        activeDashboardId: nextActiveId,
      },
    });
  };

  const handleStartEdit = () => {
    setDraftWidgets(activeDashboardWidgets);
    setIsEditing(true);
  };

  const handleAddWidget = () => {
    if (!isEditing) {
      setDraftWidgets(activeDashboardWidgets);
      setIsEditing(true);
    }
    openEditor();
  };

  const handleCancelEdit = () => {
    setDraftWidgets(activeDashboardWidgets);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const nextDashboards = dashboards.map((item) =>
      item.id === activeDashboardId
        ? { ...item, widgets: draftWidgets }
        : item,
    );
    await saveDashboards(nextDashboards, activeDashboardId);
    setIsEditing(false);
  };

  const handleDashboardChange = async (nextId: string) => {
    if (!nextId || nextId === activeDashboardId) return;
    if (
      isEditing &&
      !window.confirm('編集中の内容を破棄して切り替えますか？')
    ) {
      return;
    }
    setIsEditing(false);
    await saveDashboards(dashboards, nextId);
  };

  const handleCreateDashboard = async () => {
    const name = window.prompt('ダッシュボード名を入力してください', '新規ダッシュボード');
    if (!name) return;
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name,
      widgets: [],
    };
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    setDraftWidgets([]);
    setIsEditing(true);
  };

  const handleDuplicateDashboard = async () => {
    if (!activeDashboard) return;
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name: `${activeDashboard.name} (コピー)`,
      widgets: activeDashboard.widgets ?? [],
    };
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    setDraftWidgets(newDashboard.widgets);
    setIsEditing(false);
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboard) return;
    if (dashboards.length <= 1) {
      notification.warning('ダッシュボードは最低1つ必要です。');
      return;
    }
    const confirmed = window.confirm(
      `「${activeDashboard.name}」を削除しますか？`,
    );
    if (!confirmed) return;
    const nextDashboards = dashboards.filter(
      (item) => item.id !== activeDashboard.id,
    );
    const nextActiveId = nextDashboards[0]?.id ?? '';
    setIsEditing(false);
    await saveDashboards(nextDashboards, nextActiveId);
  };

  const pushTemplateWidgets = (widgetsToAdd: AnalysisDashboardWidget[]) => {
    const baseWidgets = isEditing ? draftWidgets : activeDashboardWidgets;
    setDraftWidgets([...baseWidgets, ...widgetsToAdd]);
    setIsEditing(true);
  };

  const handleAddTemplatePossession = () => {
    if (!availableActions.includes('ポゼッション')) {
      notification.warning(
        'ポゼッションのアクションが見つかりません。アクション名を確認してください。',
      );
      return;
    }
    const widget: AnalysisDashboardWidget = {
      id: generateWidgetId(),
      title: 'ポゼッション時間',
      chartType: 'bar',
      metric: 'duration',
      primaryAxis: { type: 'team' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionResult' },
      colSpan: 6,
      calc: 'raw',
      widgetFilters: { action: 'ポゼッション' },
    };
    pushTemplateWidgets([widget]);
  };

  const handleAddTemplateResults = () => {
    const targetActions = ACTIONS_TO_SUMMARISE.filter((action) =>
      availableActions.includes(action),
    );
    if (targetActions.length === 0) {
      notification.warning(
        '対象アクションが見つかりません。アクション名を確認してください。',
      );
      return;
    }
    const widgetsToAdd = targetActions.map((action) => ({
      id: generateWidgetId(),
      title: `${action} 結果内訳`,
      chartType: 'pie' as const,
      metric: 'count' as const,
      primaryAxis: { type: 'group', value: 'actionResult' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionResult' },
      colSpan: 6 as const,
      calc: 'percentTotal' as const,
      widgetFilters: { action },
    }));
    pushTemplateWidgets(widgetsToAdd);
  };

  const handleAddTemplateTypes = () => {
    const targetActions = ACTIONS_TO_SUMMARISE.filter((action) =>
      availableActions.includes(action),
    );
    if (targetActions.length === 0) {
      notification.warning(
        '対象アクションが見つかりません。アクション名を確認してください。',
      );
      return;
    }
    const widgetsToAdd = targetActions.map((action) => ({
      id: generateWidgetId(),
      title: `${action} 種別内訳`,
      chartType: 'pie' as const,
      metric: 'count' as const,
      primaryAxis: { type: 'group', value: 'actionType' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionType' },
      colSpan: 6 as const,
      calc: 'percentTotal' as const,
      widgetFilters: { action },
    }));
    pushTemplateWidgets(widgetsToAdd);
  };

  const handleExportDashboard = async () => {
    if (!activeDashboard) return;
    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeTextFile) {
      notification.error('エクスポート機能が利用できません。');
      return;
    }
    const defaultName = `${activeDashboard.name || 'dashboard'}.analysis-dashboard.json`;
    const filePath = await api.saveFileDialog(defaultName, [
      { name: 'Dashboard JSON', extensions: ['json'] },
    ]);
    if (!filePath) return;
    const payload = {
      version: 1,
      dashboard: activeDashboard,
    };
    const ok = await api.writeTextFile(
      filePath,
      JSON.stringify(payload, null, 2),
    );
    if (ok) {
      notification.success('ダッシュボードをエクスポートしました。');
    } else {
      notification.error('エクスポートに失敗しました。');
    }
  };

  const handleImportDashboard = async () => {
    const api = window.electronAPI;
    if (!api?.openFileDialog || !api?.readTextFile) {
      notification.error('インポート機能が利用できません。');
      return;
    }
    const filePath = await api.openFileDialog([
      { name: 'Dashboard JSON', extensions: ['json'] },
    ]);
    if (!filePath) return;
    const content = await api.readTextFile(filePath);
    if (!content) {
      notification.error('ファイルの読み込みに失敗しました。');
      return;
    }
    try {
      const parsed = JSON.parse(content) as {
        dashboard?: AnalysisDashboard;
        dashboards?: AnalysisDashboard[];
        widgets?: AnalysisDashboardWidget[];
      };
      const importedDashboards: AnalysisDashboard[] = [];
      if (Array.isArray(parsed?.dashboards)) {
        importedDashboards.push(...parsed.dashboards);
      } else if (parsed?.dashboard) {
        importedDashboards.push(parsed.dashboard);
      } else if (Array.isArray(parsed?.widgets)) {
        importedDashboards.push({
          id: generateDashboardId(),
          name: 'インポート',
          widgets: parsed.widgets,
        });
      }
      if (importedDashboards.length === 0) {
        notification.error('ダッシュボード形式のJSONではありません。');
        return;
      }

      const existingIds = new Set(dashboards.map((item) => item.id));
      const normalized = importedDashboards.map((item, index) => {
        const baseId = item.id || generateDashboardId();
        let nextId = baseId;
        let counter = 1;
        while (existingIds.has(nextId)) {
          nextId = `${baseId}-${counter}`;
          counter += 1;
        }
        existingIds.add(nextId);
        return {
          id: nextId,
          name: item.name || `インポート${index + 1}`,
          widgets: Array.isArray(item.widgets) ? item.widgets : [],
        };
      });

      const nextDashboards = [...dashboards, ...normalized];
      await saveDashboards(nextDashboards, normalized[0].id);
      notification.success('ダッシュボードをインポートしました。');
    } catch (error) {
      console.error('Failed to import dashboard:', error);
      notification.error('インポートに失敗しました。');
    }
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

  const handleResetFilters = () => {
    setDashboardFilters({});
  };

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <Stack spacing={2.5}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            分析ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
            データ棚から軸を選んで、必要なグラフを素早く作成できます
          </Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="dashboard-select-label">ダッシュボード</InputLabel>
            <Select
              labelId="dashboard-select-label"
              value={activeDashboardId}
              label="ダッシュボード"
              onChange={(event) =>
                handleDashboardChange(event.target.value as string)
              }
            >
              {dashboards.map((dashboard) => (
                <MenuItem key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {isEditing && <Chip label="編集モード" color="warning" size="small" />}
          {isEditing ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddWidget}
              >
                チャートを追加
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
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleStartEdit}
              >
                編集
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddWidget}
              >
                チャートを追加
              </Button>
            </>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<DashboardIcon />}
            onClick={(event) => setDashboardMenuAnchor(event.currentTarget)}
          >
            管理
          </Button>
        </Stack>
      </Box>

      <Menu
        anchorEl={dashboardMenuAnchor}
        open={Boolean(dashboardMenuAnchor)}
        onClose={() => setDashboardMenuAnchor(null)}
      >
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleCreateDashboard();
          }}
        >
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>新規作成</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleDuplicateDashboard();
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>複製</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleDeleteDashboard();
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setDashboardMenuAnchor(null);
            handleAddTemplatePossession();
            notification.info('テンプレートを追加しました。保存してください。');
          }}
        >
          <ListItemIcon>
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>テンプレ: ポゼッション</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDashboardMenuAnchor(null);
            handleAddTemplateResults();
            notification.info('テンプレートを追加しました。保存してください。');
          }}
        >
          <ListItemIcon>
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>テンプレ: アクション結果</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDashboardMenuAnchor(null);
            handleAddTemplateTypes();
            notification.info('テンプレートを追加しました。保存してください。');
          }}
        >
          <ListItemIcon>
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>テンプレ: アクション種別</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleImportDashboard();
          }}
        >
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>インポート</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleExportDashboard();
          }}
        >
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>エクスポート</ListItemText>
        </MenuItem>
      </Menu>

      <Divider />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
          gap: 2.5,
        }}
      >
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  データ棚
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ラベル・アクション・チームを軸にグラフを組み立てます。
                </Typography>
              </Stack>
              <Divider />
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    チーム ({availableTeams.length})
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {availableTeams.map((team) => (
                      <Chip key={team} label={team} size="small" />
                    ))}
                    {availableTeams.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        まだデータがありません
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    アクション ({availableActions.length})
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {availableActions.map((action) => (
                      <Chip key={action} label={action} size="small" />
                    ))}
                    {availableActions.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        まだデータがありません
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ラベルグループ ({availableGroups.length})
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {availableGroups.map((group) => (
                      <Chip key={group} label={group} size="small" />
                    ))}
                    {availableGroups.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        まだデータがありません
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  全体フィルター
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ダッシュボード全体のスコープを絞り込めます。
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="dashboard-filter-team">チーム</InputLabel>
                  <Select
                    labelId="dashboard-filter-team"
                    value={dashboardFilters.team ?? ''}
                    label="チーム"
                    onChange={(event) =>
                      updateDashboardFilters({
                        team: event.target.value || undefined,
                      })
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
                <FormControl size="small" fullWidth>
                  <InputLabel id="dashboard-filter-action">
                    アクション
                  </InputLabel>
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
                <FormControl size="small" fullWidth>
                  <InputLabel id="dashboard-filter-group">
                    ラベルグループ
                  </InputLabel>
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
                <FormControl size="small" fullWidth>
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
                {appliedFilterChips.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {appliedFilterChips.map((chip) => (
                      <Chip key={chip} label={chip} size="small" />
                    ))}
                    <Button size="small" onClick={handleResetFilters}>
                      リセット
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  キャンバス
                </Typography>
                <Chip
                  label={isEditing ? '編集' : '閲覧'}
                  size="small"
                  color={isEditing ? 'warning' : 'default'}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                カードの順序は上下ボタンで調整できます。
              </Typography>
              {appliedFilterChips.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {appliedFilterChips.map((chip) => (
                    <Chip key={chip} label={chip} size="small" />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          {widgets.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                borderStyle: 'dashed',
                bgcolor: 'action.hover',
              }}
            >
              <Stack spacing={1.5} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  チャートを追加してダッシュボードを作成しましょう
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  データ棚の軸やフィルターを使って、用途に合わせた可視化ができます。
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddWidget}
                >
                  チャートを追加
                </Button>
              </Stack>
            </Paper>
          ) : (
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
                  series:
                    widget.dataMode === 'series' ? widget.series : undefined,
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
                      ) : widget.chartType === 'pie' ? (
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
                    </DashboardCard>
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
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
