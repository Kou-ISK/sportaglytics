import React from 'react';
import { Box, Dialog, DialogContent } from '@mui/material';
import type { AnalysisPanelViewProps } from '../controllers/useAnalysisPanelController';
import { AnalysisPanelToolbar } from './analysisPanelView/AnalysisPanelToolbar';
import { AnalysisPanelContent } from './analysisPanelView/AnalysisPanelContent';

export const AnalysisPanelView = ({
  open,
  onClose,
  currentView,
  onChangeView,
  hasTimelineData,
  resolvedTeamNames,
  timeline,
  onJumpToSegment,
  embedded = false,
  isSyncing = false,
  onCreateAiPlaylist,
  dashboardFilters,
  onDashboardFiltersChange,
  matrixAxes,
  onMatrixAxesChange,
  matrixFilters,
  onMatrixFiltersChange,
  createMomentumData,
  exportTargetRef,
  exportAnchor,
  setExportAnchor,
  isExporting,
  onCloseExportMenu,
  onCopySummary,
  onExportPng,
  onExportPdf,
}: AnalysisPanelViewProps) => {
  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          pb: 2,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <AnalysisPanelToolbar
            currentView={currentView}
            onChangeView={onChangeView}
            isExporting={isExporting}
            exportAnchor={exportAnchor}
            setExportAnchor={setExportAnchor}
            onCloseExportMenu={onCloseExportMenu}
            onCopySummary={() => {
              void onCopySummary();
            }}
            onExportPng={() => {
              void onExportPng();
            }}
            onExportPdf={() => {
              void onExportPdf();
            }}
          />
        </Box>
      </Box>

      <Box ref={exportTargetRef} sx={{ flex: 1, overflow: 'auto' }}>
        <AnalysisPanelContent
          currentView={currentView}
          isSyncing={isSyncing}
          hasTimelineData={hasTimelineData}
          timeline={timeline}
          resolvedTeamNames={resolvedTeamNames}
          onJumpToSegment={onJumpToSegment}
          onCreateAiPlaylist={onCreateAiPlaylist}
          dashboardFilters={dashboardFilters}
          onDashboardFiltersChange={onDashboardFiltersChange}
          matrixAxes={matrixAxes}
          onMatrixAxesChange={onMatrixAxesChange}
          matrixFilters={matrixFilters}
          onMatrixFiltersChange={onMatrixFiltersChange}
          createMomentumData={createMomentumData}
        />
      </Box>
    </Box>
  );

  if (embedded) {
    return (
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {content}
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogContent sx={{ pt: 2 }}>{content}</DialogContent>
    </Dialog>
  );
};
