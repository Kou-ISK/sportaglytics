import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import { useSettings } from '../../../../../../../hooks/useSettings';
import { useNotification } from '../../../../../../../contexts/NotificationContext';
import {
  extractActionFromActionName,
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
} from '../../../../../../../utils/labelExtractors';
import { getTimelineTeamOrder } from '../../../../../../../utils/teamOrder';
import type {
  DashboardDetail,
  DashboardTabController,
  UseDashboardTabControllerParams,
} from './dashboardTabController.types';
import { buildFilterChips, generateDashboardId } from './dashboardTabController.utils';
import { useDashboardImportExport } from './useDashboardImportExport';
export const useDashboardTabController = ({
  timeline,
  teamNames,
  dashboardFilters: controlledDashboardFilters,
  onDashboardFiltersChange,
}: UseDashboardTabControllerParams): DashboardTabController => {
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

  const [isEditing, setIsEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<AnalysisDashboardWidget[]>(
    [],
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] =
    useState<AnalysisDashboardWidget | null>(null);
  const [localDashboardFilters, setLocalDashboardFilters] =
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
  const [detail, setDetail] = useState<DashboardDetail | null>(null);

  const dashboards = settings.analysisDashboard?.dashboards ?? [];
  const activeDashboardId =
    settings.analysisDashboard?.activeDashboardId ?? dashboards[0]?.id ?? '';
  const activeDashboard =
    dashboards.find((item) => item.id === activeDashboardId) ?? dashboards[0];
  const activeDashboardWidgets = activeDashboard?.widgets ?? [];
  const dashboardFilters = controlledDashboardFilters ?? localDashboardFilters;

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
    const next = { ...dashboardFilters, ...patch };
    if (onDashboardFiltersChange) {
      onDashboardFiltersChange(next);
    } else {
      setLocalDashboardFilters(next);
    }
  };

  const appliedFilterChips = useMemo(
    () => buildFilterChips('全体', dashboardFilters, teamRoleMap),
    [dashboardFilters, teamRoleMap.team1, teamRoleMap.team2],
  );

  const compactControlSx = {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
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

  const openEditor = (widget?: AnalysisDashboardWidget) => {
    setEditingWidget(widget ?? null);
    setEditorOpen(true);
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

  const { handleExportDashboard, handleImportDashboard } =
    useDashboardImportExport({
      activeDashboard,
      dashboards,
      notification,
      saveDashboards,
    });

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
    if (onDashboardFiltersChange) {
      onDashboardFiltersChange({});
    } else {
      setLocalDashboardFilters({});
    }
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

  return {
    availableGroups,
    availableTeams,
    availableActions,
    availableLabelValues,
    orderedTeams,
    teamRoleMap,
    teamContext,
    compactControlSx,
    isEditing,
    draftWidgets,
    editorOpen,
    editingWidget,
    dashboardFilters,
    dashboardMenuAnchor,
    createDialogOpen,
    newDashboardName,
    discardDialogOpen,
    pendingDashboardId,
    deleteDialogOpen,
    detail,
    dashboards,
    activeDashboardId,
    activeDashboard,
    activeDashboardWidgets,
    widgets,
    appliedFilterChips,
    timelineMap,
    updateDashboardFilters,
    handleResetFilters,
    handleStartEdit,
    handleAddWidget,
    handleCancelEdit,
    handleSave,
    handleDashboardChange,
    handleConfirmDiscardAndSwitch,
    handleCreateDashboard,
    handleDuplicateDashboard,
    handleRequestDeleteDashboard,
    handleDeleteDashboard,
    handleExportDashboard,
    handleImportDashboard,
    openEditor,
    handleEditorSave,
    handleDelete,
    handleDuplicate,
    handleMove,
    handleChartPointSelect,
    setEditorOpen,
    setDashboardMenuAnchor,
    setCreateDialogOpen,
    setNewDashboardName,
    setDiscardDialogOpen,
    setPendingDashboardId,
    setDeleteDialogOpen,
    setDetail,
  };
};
