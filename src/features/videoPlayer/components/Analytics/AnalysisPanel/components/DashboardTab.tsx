import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { DashboardSeriesFilter } from '../../../../../../types/settings/coreTypes';
import { useDashboardTabController } from '../controllers/useDashboardTabController';
import { DashboardTabView } from './DashboardTabView';

interface DashboardTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  emptyMessage: string;
  onJumpToSegment?: (segment: TimelineData) => void;
  dashboardFilters?: DashboardSeriesFilter;
  onDashboardFiltersChange?: (filters: DashboardSeriesFilter) => void;
}

const toDashboardFilterChips = (
  dashboardFilters: DashboardSeriesFilter,
  updateDashboardFilters: (patch: Partial<DashboardSeriesFilter>) => void,
) => {
  return [
    ...(dashboardFilters.team
      ? [
          {
            label: `チーム: ${dashboardFilters.team}`,
            onDelete: () => updateDashboardFilters({ team: undefined }),
          },
        ]
      : []),
    ...(dashboardFilters.action
      ? [
          {
            label: `アクション: ${dashboardFilters.action}`,
            onDelete: () => updateDashboardFilters({ action: undefined }),
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
              onDelete: () => updateDashboardFilters({ labelGroup: undefined }),
            },
          ]
        : []),
  ];
};

export const DashboardTab = ({
  hasData,
  timeline,
  teamNames,
  emptyMessage,
  onJumpToSegment,
  dashboardFilters: controlledDashboardFilters,
  onDashboardFiltersChange,
}: DashboardTabProps) => {
  const theme = useTheme();
  const {
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
  } = useDashboardTabController({
    timeline,
    teamNames,
    dashboardFilters: controlledDashboardFilters,
    onDashboardFiltersChange,
  });

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
  return (
    <DashboardTabView
      hasData={hasData}
      timeline={timeline}
      emptyMessage={emptyMessage}
      onJumpToSegment={onJumpToSegment}
      availableGroups={availableGroups}
      availableTeams={availableTeams}
      availableActions={availableActions}
      availableLabelValues={availableLabelValues}
      orderedTeams={orderedTeams}
      teamRoleMap={teamRoleMap}
      teamContext={teamContext}
      compactControlSx={compactControlSx}
      isEditing={isEditing}
      draftWidgets={draftWidgets}
      editorOpen={editorOpen}
      editingWidget={editingWidget}
      dashboardFilters={dashboardFilters}
      dashboardMenuAnchor={dashboardMenuAnchor}
      createDialogOpen={createDialogOpen}
      newDashboardName={newDashboardName}
      discardDialogOpen={discardDialogOpen}
      pendingDashboardId={pendingDashboardId}
      deleteDialogOpen={deleteDialogOpen}
      detail={detail}
      dashboards={dashboards}
      activeDashboardId={activeDashboardId}
      activeDashboard={activeDashboard}
      activeDashboardWidgets={activeDashboardWidgets}
      widgets={widgets}
      appliedFilterChips={appliedFilterChips}
      timelineMap={timelineMap}
      updateDashboardFilters={updateDashboardFilters}
      handleResetFilters={handleResetFilters}
      handleStartEdit={handleStartEdit}
      handleAddWidget={handleAddWidget}
      handleCancelEdit={handleCancelEdit}
      handleSave={handleSave}
      handleDashboardChange={handleDashboardChange}
      handleConfirmDiscardAndSwitch={handleConfirmDiscardAndSwitch}
      handleCreateDashboard={handleCreateDashboard}
      handleDuplicateDashboard={handleDuplicateDashboard}
      handleRequestDeleteDashboard={handleRequestDeleteDashboard}
      handleDeleteDashboard={handleDeleteDashboard}
      handleExportDashboard={handleExportDashboard}
      handleImportDashboard={handleImportDashboard}
      openEditor={openEditor}
      handleEditorSave={handleEditorSave}
      handleDelete={handleDelete}
      handleDuplicate={handleDuplicate}
      handleMove={handleMove}
      handleChartPointSelect={handleChartPointSelect}
      setEditorOpen={setEditorOpen}
      setDashboardMenuAnchor={setDashboardMenuAnchor}
      setCreateDialogOpen={setCreateDialogOpen}
      setNewDashboardName={setNewDashboardName}
      setDiscardDialogOpen={setDiscardDialogOpen}
      setPendingDashboardId={setPendingDashboardId}
      setDeleteDialogOpen={setDeleteDialogOpen}
      setDetail={setDetail}
      filterChips={toDashboardFilterChips(
        dashboardFilters,
        updateDashboardFilters,
      )}
      teamColorMap={teamColorMap}
    />
  );
};
