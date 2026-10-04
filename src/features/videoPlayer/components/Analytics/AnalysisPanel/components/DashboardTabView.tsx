import React from 'react';
import { Alert, Box, Chip, Stack } from '@mui/material';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { DashboardTabController } from '../controllers/dashboardTabController.types';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { DashboardWidgetDialog } from './DashboardWidgetDialog';
import { DrilldownDialog } from './DrilldownDialog';
import { DashboardFilterEditor } from './dashboardTab/DashboardFilterEditor';
import { DashboardFilterControl } from './dashboardTab/DashboardFilterControl';
import { DashboardHeaderBar } from './dashboardTab/DashboardHeaderBar';
import { DashboardManagementDialogs } from './dashboardTab/DashboardManagementDialogs';
import { DashboardManagementMenu } from './dashboardTab/DashboardManagementMenu';
import { DashboardWidgetGrid } from './dashboardTab/DashboardWidgetGrid';

interface DashboardTabViewProps extends DashboardTabController {
  disableAnimation?: boolean;
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
  onJumpToSegment?: (segment: TimelineData) => void;
  filterChips: Array<{ label: string; onDelete: () => void }>;
  teamColorMap: Record<string, string>;
}

export const DashboardTabView = ({
  disableAnimation = false,
  hasData,
  timeline,
  emptyMessage,
  onJumpToSegment,
  availableGroups,
  availableTeams,
  availableActions,
  availableLabelValues,
  teamRoleMap,
  teamContext,
  compactControlSx,
  isEditing,
  isSaving,
  saveError,
  editorOpen,
  editingWidget,
  dashboardFilters,
  dashboardMenuAnchor,
  createDialogOpen,
  newDashboardName,
  discardDialogOpen,
  deleteDialogOpen,
  detail,
  dashboards,
  activeDashboardId,
  activeDashboard,
  widgets,
  appliedFilterChips,
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
  filterChips,
  teamColorMap,
}: DashboardTabViewProps): React.JSX.Element => {
  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  if (timeline.length === 0) {
    return <NoDataPlaceholder message="表示できるタイムラインがありません。" />;
  }

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.custom.zIndex.stickyChrome,
          bgcolor: 'background.default',
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack spacing={1}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <DashboardHeaderBar
            compactControlSx={compactControlSx}
            activeDashboardId={activeDashboardId}
            dashboards={dashboards}
            isEditing={isEditing}
            isSaving={isSaving}
            filterControl={
              <DashboardFilterControl
                filterCount={appliedFilterChips.length}
                renderEditor={(onClose) => (
                  <DashboardFilterEditor
                    compactControlSx={compactControlSx}
                    dashboardFilters={dashboardFilters}
                    availableTeams={availableTeams}
                    availableActions={availableActions}
                    availableGroups={availableGroups}
                    availableLabelValues={availableLabelValues}
                    updateDashboardFilters={updateDashboardFilters}
                    onResetFilters={handleResetFilters}
                    onClose={onClose}
                  />
                )}
              />
            }
            onDashboardChange={(nextId) => {
              void handleDashboardChange(nextId);
            }}
            onStartEdit={() => void handleStartEdit()}
            onAddWidget={handleAddWidget}
            onCancelEdit={handleCancelEdit}
            onSave={() => {
              void handleSave();
            }}
            onOpenManagementMenu={setDashboardMenuAnchor}
          />

          {filterChips.length > 0 && (
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              aria-label="適用中のフィルター"
            >
              {filterChips.map((chip, index) => (
                <Chip
                  key={index}
                  label={chip.label}
                  onDelete={chip.onDelete}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Box>

      <DashboardManagementMenu
        anchorEl={dashboardMenuAnchor}
        onClose={() => setDashboardMenuAnchor(null)}
        activeDashboard={activeDashboard}
        onCreate={() => {
          setNewDashboardName('新規ダッシュボード');
          setCreateDialogOpen(true);
        }}
        onDuplicate={handleDuplicateDashboard}
        onRequestDelete={handleRequestDeleteDashboard}
        onImport={handleImportDashboard}
        onExport={handleExportDashboard}
      />

      <DashboardWidgetGrid
        disableAnimation={disableAnimation}
        widgets={widgets}
        isEditing={isEditing && !isSaving}
        onAddWidget={handleAddWidget}
        onEditWidget={openEditor}
        onDuplicateWidget={handleDuplicate}
        onMoveWidget={handleMove}
        onDeleteWidget={handleDelete}
        onChartPointSelect={handleChartPointSelect}
        timeline={timeline}
        availableGroups={availableGroups}
        dashboardFilters={dashboardFilters}
        teamRoleMap={teamRoleMap}
        teamContext={teamContext}
        teamColorMap={teamColorMap}
      />

      <DashboardWidgetDialog
        open={editorOpen}
        availableGroups={availableGroups}
        availableActions={availableActions}
        availableLabelValues={availableLabelValues}
        initial={editingWidget}
        onSave={handleEditorSave}
        onClose={() => setEditorOpen(false)}
      />

      <DashboardManagementDialogs
        isSaving={isSaving}
        saveError={saveError}
        createDialogOpen={createDialogOpen}
        onCreateDialogClose={() => {
          setCreateDialogOpen(false);
          setNewDashboardName('新規ダッシュボード');
        }}
        newDashboardName={newDashboardName}
        setNewDashboardName={setNewDashboardName}
        onCreateDashboard={handleCreateDashboard}
        discardDialogOpen={discardDialogOpen}
        onDiscardDialogClose={() => {
          setDiscardDialogOpen(false);
          setPendingDashboardId(null);
        }}
        onConfirmDiscardAndSwitch={handleConfirmDiscardAndSwitch}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogClose={() => setDeleteDialogOpen(false)}
        activeDashboard={activeDashboard}
        onDeleteDashboard={handleDeleteDashboard}
      />

      <DrilldownDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onJump={(segment) => onJumpToSegment?.(segment)}
      />
    </Stack>
  );
};
