import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Dialog, DialogContent } from '@mui/material';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { AnalysisView } from '../../../../../../types/AnalysisView';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import type { DashboardSeriesFilter } from '../../../../../../types/Settings';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import { createMomentumDataFactory } from '../../../../analysis/utils/momentum';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { useSettings } from '../../../../../../hooks/useSettings';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import {
  createDefaultMatrixFilters,
  type MatrixFilterState,
} from './hooks/matrixFilterUtils';
import { useAnalysisExportActions } from './hooks/useAnalysisExportActions';
import { AnalysisPanelToolbar } from './analysisPanelView/AnalysisPanelToolbar';
import { AnalysisPanelContent } from './analysisPanelView/AnalysisPanelContent';

interface AnalysisPanelViewProps extends AnalysisPanelDerivedState {
  open: boolean;
  onClose: () => void;
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
  isSyncing?: boolean;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
}

const pickInitialAxis = (availableGroups: string[], preferred: string) => {
  if (availableGroups.length === 0) return '';
  if (availableGroups.includes(preferred)) return preferred;
  if (availableGroups.length > 1) return availableGroups[1];
  return availableGroups[0];
};

const getInitialMatrixAxes = (availableGroups: string[]) => {
  const rowValue =
    availableGroups.length === 0
      ? ''
      : availableGroups.includes('actionType')
        ? 'actionType'
        : availableGroups[0];
  const colValue = pickInitialAxis(availableGroups, 'actionResult');

  return {
    row: { type: 'group', value: rowValue } as MatrixAxisConfig,
    column: { type: 'group', value: colValue } as MatrixAxisConfig,
  };
};

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
}: AnalysisPanelViewProps) => {
  const { settings } = useSettings();
  const notification = useNotification();
  const exportTargetRef = useRef<HTMLDivElement | null>(null);

  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [matrixFilters, setMatrixFilters] = useState<MatrixFilterState>(
    createDefaultMatrixFilters(),
  );

  const availableGroups = useMemo(() => extractUniqueGroups(timeline), [timeline]);
  const [matrixAxes, setMatrixAxes] = useState<{
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }>(() => getInitialMatrixAxes(availableGroups));

  useEffect(() => {
    setMatrixAxes(getInitialMatrixAxes(availableGroups));
  }, [availableGroups]);

  const filteredMomentumDataFactory = useMemo(
    () => createMomentumDataFactory(timeline),
    [timeline],
  );

  const {
    exportAnchor,
    setExportAnchor,
    isExporting,
    closeExportMenu,
    handleCopySummary,
    handleExportPng,
    handleExportPdf,
  } = useAnalysisExportActions({
    currentView,
    timeline,
    resolvedTeamNames,
    dashboardFilters,
    matrixAxes,
    matrixFilters,
    analysisDashboard: settings.analysisDashboard,
    notification,
    exportTargetRef,
  });

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
            onCloseExportMenu={closeExportMenu}
            onCopySummary={() => {
              void handleCopySummary();
            }}
            onExportPng={() => {
              void handleExportPng();
            }}
            onExportPdf={() => {
              void handleExportPdf();
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
          onDashboardFiltersChange={setDashboardFilters}
          matrixAxes={matrixAxes}
          onMatrixAxesChange={setMatrixAxes}
          matrixFilters={matrixFilters}
          onMatrixFiltersChange={setMatrixFilters}
          createMomentumData={filteredMomentumDataFactory}
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
