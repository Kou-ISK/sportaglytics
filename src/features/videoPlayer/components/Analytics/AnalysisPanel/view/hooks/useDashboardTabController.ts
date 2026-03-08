import { useCallback, useEffect } from 'react';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import { useSettings } from '../../../../../../../hooks/useSettings';
import { useNotification } from '../../../../../../../contexts/NotificationContext';
import type {
  DashboardTabController,
  UseDashboardTabControllerParams,
} from './dashboardTabController.types';
import { generateDashboardId } from './dashboardTabController.utils';
import { useDashboardImportExport } from './useDashboardImportExport';
import { useDashboardTabDerived } from './useDashboardTabDerived';
import { useDashboardTabState } from './useDashboardTabState';
import { useDashboardWidgetDraftActions } from './useDashboardWidgetDraftActions';

export const useDashboardTabController = ({
  timeline,
  teamNames,
  dashboardFilters: controlledDashboardFilters,
  onDashboardFiltersChange,
}: UseDashboardTabControllerParams): DashboardTabController => {
  const { settings, saveSettings } = useSettings();
  const notification = useNotification();
  const state = useDashboardTabState();

  const dashboards = settings.analysisDashboard?.dashboards ?? [];
  const activeDashboardId =
    settings.analysisDashboard?.activeDashboardId ?? dashboards[0]?.id ?? '';
  const activeDashboard =
    dashboards.find((item) => item.id === activeDashboardId) ?? dashboards[0];
  const activeDashboardWidgets = activeDashboard?.widgets ?? [];
  const dashboardFilters = controlledDashboardFilters ?? state.localDashboardFilters;

  const derived = useDashboardTabDerived({
    timeline,
    teamNames,
    dashboardFilters,
  });

  const widgets = state.isEditing ? state.draftWidgets : activeDashboardWidgets;

  useEffect(() => {
    if (!state.isEditing) {
      state.setDraftWidgets(activeDashboardWidgets);
    }
  }, [activeDashboardWidgets, state]);

  const updateDashboardFilters = (patch: Partial<DashboardSeriesFilter>) => {
    const next = { ...dashboardFilters, ...patch };
    if (onDashboardFiltersChange) {
      onDashboardFiltersChange(next);
    } else {
      state.setLocalDashboardFilters(next);
    }
  };

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
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(true);
  };

  const openEditor = (widget?: AnalysisDashboardWidget) => {
    state.setEditingWidget(widget ?? null);
    state.setEditorOpen(true);
  };

  const handleAddWidget = () => {
    if (!state.isEditing) {
      state.setDraftWidgets(activeDashboardWidgets);
      state.setIsEditing(true);
    }
    openEditor();
  };

  const handleCancelEdit = () => {
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(false);
  };

  const handleSave = async () => {
    const nextDashboards = dashboards.map((item) =>
      item.id === activeDashboardId ? { ...item, widgets: state.draftWidgets } : item,
    );
    await saveDashboards(nextDashboards, activeDashboardId);
    state.setIsEditing(false);
  };

  const handleDashboardChange = async (nextId: string) => {
    if (!nextId || nextId === activeDashboardId) return;
    if (state.isEditing) {
      state.setPendingDashboardId(nextId);
      state.setDiscardDialogOpen(true);
      return;
    }
    state.setIsEditing(false);
    await saveDashboards(dashboards, nextId);
  };

  const handleConfirmDiscardAndSwitch = async () => {
    if (!state.pendingDashboardId) {
      state.setDiscardDialogOpen(false);
      return;
    }
    const nextId = state.pendingDashboardId;
    state.setPendingDashboardId(null);
    state.setDiscardDialogOpen(false);
    state.setIsEditing(false);
    await saveDashboards(dashboards, nextId);
  };

  const handleCreateDashboard = async () => {
    const name = state.newDashboardName.trim();
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
    state.setDraftWidgets([]);
    state.setIsEditing(true);
    state.setCreateDialogOpen(false);
    state.setNewDashboardName('新規ダッシュボード');
  };

  const handleDuplicateDashboard = async () => {
    if (!activeDashboard) return;
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name: `${activeDashboard.name} (コピー)`,
      widgets: activeDashboard.widgets ?? [],
    };
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    state.setDraftWidgets(newDashboard.widgets);
    state.setIsEditing(false);
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
    state.setDeleteDialogOpen(true);
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboard) return;
    const nextDashboards = dashboards.filter(
      (item) => item.id !== activeDashboard.id,
    );
    const nextActiveId = nextDashboards[0]?.id ?? '';
    state.setDeleteDialogOpen(false);
    state.setIsEditing(false);
    await saveDashboards(nextDashboards, nextActiveId);
  };

  const { handleExportDashboard, handleImportDashboard } =
    useDashboardImportExport({
      activeDashboard,
      dashboards,
      notification,
      saveDashboards,
    });

  const { handleEditorSave, handleDelete, handleDuplicate, handleMove } =
    useDashboardWidgetDraftActions({
      setDraftWidgets: state.setDraftWidgets,
      setEditorOpen: state.setEditorOpen,
    });

  const handleResetFilters = () => {
    if (onDashboardFiltersChange) {
      onDashboardFiltersChange({});
    } else {
      state.setLocalDashboardFilters({});
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
        .map((id) => derived.timelineMap.get(id))
        .filter((item): item is TimelineData => Boolean(item));
      state.setDetail({
        title: `Dashboard > ${widgetTitle} > ${payload.title}`,
        entries,
      });
    },
    [derived.timelineMap, state],
  );

  return {
    availableGroups: derived.availableGroups,
    availableTeams: derived.availableTeams,
    availableActions: derived.availableActions,
    availableLabelValues: derived.availableLabelValues,
    orderedTeams: derived.orderedTeams,
    teamRoleMap: derived.teamRoleMap,
    teamContext: derived.teamContext,
    compactControlSx,
    isEditing: state.isEditing,
    draftWidgets: state.draftWidgets,
    editorOpen: state.editorOpen,
    editingWidget: state.editingWidget,
    dashboardFilters,
    dashboardMenuAnchor: state.dashboardMenuAnchor,
    createDialogOpen: state.createDialogOpen,
    newDashboardName: state.newDashboardName,
    discardDialogOpen: state.discardDialogOpen,
    pendingDashboardId: state.pendingDashboardId,
    deleteDialogOpen: state.deleteDialogOpen,
    detail: state.detail,
    dashboards,
    activeDashboardId,
    activeDashboard,
    activeDashboardWidgets,
    widgets,
    appliedFilterChips: derived.appliedFilterChips,
    timelineMap: derived.timelineMap,
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
    setEditorOpen: state.setEditorOpen,
    setDashboardMenuAnchor: state.setDashboardMenuAnchor,
    setCreateDialogOpen: state.setCreateDialogOpen,
    setNewDashboardName: state.setNewDashboardName,
    setDiscardDialogOpen: state.setDiscardDialogOpen,
    setPendingDashboardId: state.setPendingDashboardId,
    setDeleteDialogOpen: state.setDeleteDialogOpen,
    setDetail: state.setDetail,
  };
};
