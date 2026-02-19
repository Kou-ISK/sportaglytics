import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import OutboxIcon from '@mui/icons-material/Outbox';
import DashboardIcon from '@mui/icons-material/Dashboard';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { useSettings } from '../../../../../../hooks/useSettings';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { FilterSummaryBar } from './FilterSummaryBar';
import { replaceTeamPlaceholders } from '../../../../../../utils/teamPlaceholder';
import {
  extractActionFromActionName,
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
} from '../../../../../../utils/labelExtractors';
import { getTimelineTeamOrder } from '../../../../../../utils/teamOrder';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { DashboardCard } from './DashboardCard';
import { DashboardWidgetDialog } from './DashboardWidgetDialog';
import { buildCustomChartData } from './hooks/useCustomChartData';
import { CustomBarChart } from './CustomBarChart';
import { CustomPieChart } from './CustomPieChart';
import { DrilldownDialog } from './DrilldownDialog';

interface DashboardTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  emptyMessage: string;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const DashboardTab = ({
  hasData,
  timeline,
  teamNames,
  emptyMessage,
  onJumpToSegment,
}: DashboardTabProps) => {
  const theme = useTheme();
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
  const orderedTeams = useMemo(() => {
    const fromTimeline = getTimelineTeamOrder(timeline).filter(Boolean);
    if (fromTimeline.length > 0) return fromTimeline;
    return availableTeams;
  }, [timeline, availableTeams]);
  const teamRoleMap = useMemo(
    () => ({
      team1: orderedTeams[0],
      team2: orderedTeams[1],
    }),
    [orderedTeams],
  );
  const teamContext = useMemo(
    () => ({
      team1Name: orderedTeams[0] || 'Team1',
      team2Name: orderedTeams[1] || 'Team2',
    }),
    [orderedTeams],
  );
  const teamColorMap = useMemo(() => {
    const map: Record<string, string> = {
      Team1: theme.palette.team1.main,
      Team2: theme.palette.team2.main,
    };
    if (orderedTeams[0]) {
      map[orderedTeams[0]] = theme.palette.team1.main;
    }
    if (orderedTeams[1]) {
      map[orderedTeams[1]] = theme.palette.team2.main;
    }
    return map;
  }, [orderedTeams, theme.palette.team1.main, theme.palette.team2.main]);

  const [isEditing, setIsEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<AnalysisDashboardWidget[]>(
    [],
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] =
    useState<AnalysisDashboardWidget | null>(null);
  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [dashboardMenuAnchor, setDashboardMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('新規ダッシュボード');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingDashboardId, setPendingDashboardId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);
  const dashboards = settings.analysisDashboard?.dashboards ?? [];
  const activeDashboardId =
    settings.analysisDashboard?.activeDashboardId ?? dashboards[0]?.id ?? '';
  const activeDashboard =
    dashboards.find((item) => item.id === activeDashboardId) ?? dashboards[0];
  const activeDashboardWidgets = activeDashboard?.widgets ?? [];

  const widgets = isEditing ? draftWidgets : activeDashboardWidgets;
  const timelineMap = useMemo(
    () => new Map(timeline.map((item) => [item.id, item])),
    [timeline],
  );

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
    if (filters.teamRole) {
      const resolved =
        filters.teamRole === 'team1' ? teamRoleMap.team1 : teamRoleMap.team2;
      chips.push(`${prefix} チーム=${resolved || filters.teamRole}`);
    }
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
  const compactControlSx = {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
  };

  const generateDashboardId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      item.id === activeDashboardId ? { ...item, widgets: draftWidgets } : item,
    );
    await saveDashboards(nextDashboards, activeDashboardId);
    setIsEditing(false);
  };

  const handleDashboardChange = async (nextId: string) => {
    if (!nextId || nextId === activeDashboardId) return;
    if (isEditing) {
      setPendingDashboardId(nextId);
      setDiscardDialogOpen(true);
      return;
    }
    setIsEditing(false);
    await saveDashboards(dashboards, nextId);
  };

  const handleConfirmDiscardAndSwitch = async () => {
    if (!pendingDashboardId) {
      setDiscardDialogOpen(false);
      return;
    }
    const nextId = pendingDashboardId;
    setPendingDashboardId(null);
    setDiscardDialogOpen(false);
    setIsEditing(false);
    await saveDashboards(dashboards, nextId);
  };

  const handleCreateDashboard = async () => {
    const name = newDashboardName.trim();
    if (!name) {
      notification.warning('ダッシュボード名を入力してください。');
      return;
    }
    if (
      dashboards.some(
        (dashboard) => dashboard.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      notification.warning('同名のダッシュボードが既に存在します。');
      return;
    }
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name,
      widgets: [],
    };
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    setDraftWidgets([]);
    setIsEditing(true);
    setCreateDialogOpen(false);
    setNewDashboardName('新規ダッシュボード');
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

  const handleRequestDeleteDashboard = () => {
    if (!activeDashboard) return;
    const protectedIds = new Set(['default', 'template-basic']);
    if (protectedIds.has(activeDashboard.id)) {
      notification.warning('このダッシュボードは削除できません。');
      return;
    }
    if (dashboards.length <= 1) {
      notification.warning('ダッシュボードは最低1つ必要です。');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboard) return;
    const nextDashboards = dashboards.filter(
      (item) => item.id !== activeDashboard.id,
    );
    const nextActiveId = nextDashboards[0]?.id ?? '';
    setDeleteDialogOpen(false);
    setIsEditing(false);
    await saveDashboards(nextDashboards, nextActiveId);
  };

  const handleExportDashboard = async () => {
    if (!activeDashboard) return;
    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.saveDashboardPackage) {
      notification.error('エクスポート機能が利用できません。');
      return;
    }
    const defaultName = `${activeDashboard.name || 'dashboard'}.stad`;
    const filePath = await api.saveFileDialog(defaultName, [
      { name: 'SporTagLytics Dashboard', extensions: ['stad'] },
    ]);
    if (!filePath) return;
    const payload = {
      version: 1,
      dashboard: activeDashboard,
    };
    const ok = await api.saveDashboardPackage(
      filePath,
      JSON.stringify(payload, null, 2),
    );
    if (ok) {
      notification.success('ダッシュボードをエクスポートしました。');
    } else {
      notification.error('エクスポートに失敗しました。');
    }
  };

  const importDashboardFromPath = useCallback(
    async (filePath: string) => {
      const api = window.electronAPI;
      if (!api?.readTextFile || !api?.readDashboardPackage) {
        notification.error('インポート機能が利用できません。');
        return;
      }
      const lowerPath = filePath.toLowerCase();
      const content = lowerPath.endsWith('.stad')
        ? await api.readDashboardPackage(filePath)
        : await api.readTextFile(filePath);
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
    },
    [dashboards, generateDashboardId, notification, saveDashboards],
  );

  const handleImportDashboard = async () => {
    const api = window.electronAPI;
    if (!api?.openDashboardPackageDialog) {
      notification.error('インポート機能が利用できません。');
      return;
    }
    const filePath = await api.openDashboardPackageDialog([
      { name: 'SporTagLytics Dashboard', extensions: ['stad', 'json'] },
    ]);
    if (!filePath) return;
    await importDashboardFromPath(filePath);
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.on || !api?.off) return;
    const handler = (_event: unknown, filePath?: unknown) => {
      if (typeof filePath !== 'string' || filePath.length === 0) return;
      void importDashboardFromPath(filePath);
    };
    api.on('analysis-dashboard:external-open', handler);
    return () => {
      api.off('analysis-dashboard:external-open', handler);
    };
  }, [importDashboardFromPath]);

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

  const handleChartPointSelect = useCallback(
    (
      widgetTitle: string,
      payload: {
        title: string;
        entryIds: string[];
      },
    ) => {
      if (!payload.entryIds || payload.entryIds.length === 0) return;
      const uniqueEntryIds = Array.from(new Set(payload.entryIds));
      const entries = uniqueEntryIds
        .map((id) => timelineMap.get(id))
        .filter((item): item is TimelineData => Boolean(item));
      setDetail({
        title: `Dashboard > ${widgetTitle} > ${payload.title}`,
        entries,
      });
    },
    [timelineMap],
  );

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  if (timeline.length === 0) {
    return (
      <NoDataPlaceholder
        message="表示できるタイムラインがありません。"
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          pb: 2,
        }}
      >
        <Stack spacing={1.5}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <FormControl
              size="small"
              sx={{ minWidth: 220, ...compactControlSx }}
            >
              <InputLabel id="dashboard-select-label">
                ダッシュボード
              </InputLabel>
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
            <Stack direction="row" spacing={1} alignItems="center">
              {isEditing && (
                <Chip label="編集モード" color="warning" size="small" />
              )}
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

          <FilterSummaryBar
            rowAxis={{ type: 'team', value: '' }}
            columnAxis={{ type: 'action', value: '' }}
            showAxisSection={false}
            showFilterSection={true}
            hasActiveFilters={appliedFilterChips.length > 0}
            filterCount={appliedFilterChips.length}
            filterChips={[
              ...(dashboardFilters.team
                ? [
                    {
                      label: `チーム: ${dashboardFilters.team}`,
                      onDelete: () =>
                        updateDashboardFilters({ team: undefined }),
                    },
                  ]
                : []),
              ...(dashboardFilters.action
                ? [
                    {
                      label: `アクション: ${dashboardFilters.action}`,
                      onDelete: () =>
                        updateDashboardFilters({ action: undefined }),
                    },
                  ]
                : []),
              ...(dashboardFilters.labelGroup && dashboardFilters.labelValue
                ? [
                    {
                      label: `${dashboardFilters.labelGroup}: ${dashboardFilters.labelValue}`,
                      onDelete: () =>
                        updateDashboardFilters({
                          labelGroup: undefined,
                          labelValue: undefined,
                        }),
                    },
                  ]
                : dashboardFilters.labelGroup
                  ? [
                      {
                        label: `ラベルグループ: ${dashboardFilters.labelGroup}`,
                        onDelete: () =>
                          updateDashboardFilters({ labelGroup: undefined }),
                      },
                    ]
                  : []),
            ]}
            renderFilterEditor={(onClose) => (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  全体フィルター設定
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ダッシュボード全体のスコープを絞り込めます。
                </Typography>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
                  <FormControl size="small" fullWidth sx={compactControlSx}>
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
                  <FormControl size="small" fullWidth sx={compactControlSx}>
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
                  <FormControl size="small" fullWidth sx={compactControlSx}>
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
                  <FormControl size="small" fullWidth sx={compactControlSx}>
                    <InputLabel id="dashboard-filter-value">
                      ラベル値
                    </InputLabel>
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
                      {(
                        (dashboardFilters.labelGroup &&
                          availableLabelValues[dashboardFilters.labelGroup]) ||
                        []
                      ).map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box display="flex" justifyContent="flex-end" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleResetFilters}
                  >
                    すべてクリア
                  </Button>
                  <Button size="small" variant="contained" onClick={onClose}>
                    閉じる
                  </Button>
                </Box>
              </Stack>
            )}
          />
        </Stack>
      </Box>

      <Menu
        anchorEl={dashboardMenuAnchor}
        open={Boolean(dashboardMenuAnchor)}
        onClose={() => setDashboardMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setDashboardMenuAnchor(null);
            setNewDashboardName('新規ダッシュボード');
            setCreateDialogOpen(true);
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
          disabled={
            activeDashboard?.id === 'default' ||
            activeDashboard?.id === 'template-basic'
          }
          onClick={() => {
            setDashboardMenuAnchor(null);
            handleRequestDeleteDashboard();
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            setDashboardMenuAnchor(null);
            await handleImportDashboard();
          }}
        >
          <ListItemIcon>
            <MoveToInboxIcon fontSize="small" />
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
            <OutboxIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>エクスポート</ListItemText>
        </MenuItem>
      </Menu>

      <Stack spacing={2}>
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
                フィルターや軸を使って、用途に合わせた可視化ができます。
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
              const resolvedWidgetTitle = replaceTeamPlaceholders(
                widget.title,
                teamContext,
              );
              const chart = buildCustomChartData(timeline, availableGroups, {
                primaryAxis: widget.primaryAxis,
                seriesAxis: widget.seriesAxis,
                seriesEnabled: widget.seriesEnabled,
                metric: widget.metric,
                analysisMode: widget.analysisMode,
                limit: widget.limit,
                series:
                  widget.dataMode === 'series' ? widget.series : undefined,
                calc: widget.calc,
                baseFilters: dashboardFilters,
                widgetFilters: widget.widgetFilters,
                teamRoleMap,
                timeBucketSec: widget.timeBucketSec,
                histogramBinSec: widget.histogramBinSec,
                rollingWindow: widget.rollingWindow,
                outlierIqrMultiplier: widget.outlierIqrMultiplier,
              });

              return (
                <Box
                  key={widget.id}
                  sx={{ gridColumn: `span ${widget.colSpan}` }}
                >
                  <DashboardCard
                    title={resolvedWidgetTitle}
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
                        height={260}
                        teamColorMap={teamColorMap}
                        onPointSelect={(payload) =>
                          handleChartPointSelect(resolvedWidgetTitle, payload)
                        }
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
                        calcMode={chart.calcMode}
                        height={240}
                        teamColorMap={teamColorMap}
                        onPointSelect={(payload) =>
                          handleChartPointSelect(resolvedWidgetTitle, payload)
                        }
                      />
                    )}
                  </DashboardCard>
                </Box>
              );
            })}
          </Box>
        )}
      </Stack>

      <DashboardWidgetDialog
        open={editorOpen}
        availableGroups={availableGroups}
        availableActions={availableActions}
        availableLabelValues={availableLabelValues}
        initial={editingWidget}
        onSave={handleEditorSave}
        onClose={() => setEditorOpen(false)}
      />

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setNewDashboardName('新規ダッシュボード');
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ダッシュボードを新規作成</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            名前を入力して新しいダッシュボードを作成します。
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="ダッシュボード名"
            value={newDashboardName}
            onChange={(event) => setNewDashboardName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreateDashboard();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setNewDashboardName('新規ダッシュボード');
            }}
          >
            キャンセル
          </Button>
          <Button variant="contained" onClick={() => void handleCreateDashboard()}>
            作成
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discardDialogOpen}
        onClose={() => {
          setDiscardDialogOpen(false);
          setPendingDashboardId(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>編集中の変更を破棄しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            保存していない変更は失われます。ダッシュボードを切り替えますか。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDiscardDialogOpen(false);
              setPendingDashboardId(null);
            }}
          >
            キャンセル
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => void handleConfirmDiscardAndSwitch()}
          >
            破棄して切り替え
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ダッシュボードを削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{activeDashboard?.name ?? ''}」を削除します。この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleDeleteDashboard()}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      <DrilldownDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onJump={(segment) => onJumpToSegment?.(segment)}
      />
    </Stack>
  );
};
