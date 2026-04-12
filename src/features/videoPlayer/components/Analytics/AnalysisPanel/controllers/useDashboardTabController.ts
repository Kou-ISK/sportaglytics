import { useEffect } from 'react';
import { useSettings } from '../../../../../../hooks/useSettings';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import type {
  DashboardTabController,
  UseDashboardTabControllerParams,
} from './dashboardTabController.types';
import { useDashboardTabActions } from './useDashboardTabActions';
import { useDashboardTabDerived } from './useDashboardTabDerived';
import { useDashboardTabState } from './useDashboardTabState';

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
  const dashboardFilters =
    controlledDashboardFilters ?? state.localDashboardFilters;

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

  const actions = useDashboardTabActions({
    settings,
    saveSettings,
    notification,
    dashboards,
    activeDashboardId,
    activeDashboard,
    activeDashboardWidgets,
    dashboardFilters,
    onDashboardFiltersChange,
    timelineMap: derived.timelineMap,
    state,
  });

  return {
    availableGroups: derived.availableGroups,
    availableTeams: derived.availableTeams,
    availableActions: derived.availableActions,
    availableLabelValues: derived.availableLabelValues,
    orderedTeams: derived.orderedTeams,
    teamRoleMap: derived.teamRoleMap,
    teamContext: derived.teamContext,
    compactControlSx: actions.compactControlSx,
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
    updateDashboardFilters: actions.updateDashboardFilters,
    handleResetFilters: actions.handleResetFilters,
    handleStartEdit: actions.handleStartEdit,
    handleAddWidget: actions.handleAddWidget,
    handleCancelEdit: actions.handleCancelEdit,
    handleSave: actions.handleSave,
    handleDashboardChange: actions.handleDashboardChange,
    handleConfirmDiscardAndSwitch: actions.handleConfirmDiscardAndSwitch,
    handleCreateDashboard: actions.handleCreateDashboard,
    handleDuplicateDashboard: actions.handleDuplicateDashboard,
    handleRequestDeleteDashboard: actions.handleRequestDeleteDashboard,
    handleDeleteDashboard: actions.handleDeleteDashboard,
    handleExportDashboard: actions.handleExportDashboard,
    handleImportDashboard: actions.handleImportDashboard,
    openEditor: actions.openEditor,
    handleEditorSave: actions.handleEditorSave,
    handleDelete: actions.handleDelete,
    handleDuplicate: actions.handleDuplicate,
    handleMove: actions.handleMove,
    handleChartPointSelect: actions.handleChartPointSelect,
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
