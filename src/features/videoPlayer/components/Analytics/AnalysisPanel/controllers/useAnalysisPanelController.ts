import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { AnalysisView } from '../../../../../../types/analysis/view';
import type { CreateMomentumDataFn } from '../../../../../../types/analysis/momentum';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';
import type { DashboardSeriesFilter } from '../../../../../../types/settings/coreTypes';
import type { PlaylistItem } from '../../../../../../types/playlist/core';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { useSettings } from '../../../../../../hooks/useSettings';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { createMomentumDataFactory } from '../../../../analysis/utils/momentum';
import {
  createDefaultMatrixFilters,
  type MatrixFilterState,
} from './matrixFilterUtils';
import { useAnalysisExportActions } from './useAnalysisExportActions';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';

interface UseAnalysisPanelControllerParams extends AnalysisPanelDerivedState {
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

export interface AnalysisPanelViewProps {
  open: boolean;
  onClose: () => void;
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  hasTimelineData: boolean;
  resolvedTeamNames: string[];
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
  isSyncing?: boolean;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  dashboardFilters: DashboardSeriesFilter;
  onDashboardFiltersChange: (filters: DashboardSeriesFilter) => void;
  matrixAxes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  };
  onMatrixAxesChange: (axes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }) => void;
  matrixFilters: MatrixFilterState;
  onMatrixFiltersChange: (filters: MatrixFilterState) => void;
  createMomentumData: CreateMomentumDataFn;
  exportTargetRef: RefObject<HTMLDivElement | null>;
  exportAnchor: HTMLElement | null;
  setExportAnchor: (anchor: HTMLElement | null) => void;
  isExporting: boolean;
  onCloseExportMenu: () => void;
  onCopySummary: () => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

const pickInitialAxis = (
  availableGroups: string[],
  preferred: string,
): string => {
  if (availableGroups.length === 0) {
    return '';
  }
  if (availableGroups.includes(preferred)) {
    return preferred;
  }
  if (availableGroups.length > 1) {
    return availableGroups[1];
  }
  return availableGroups[0];
};

const getInitialMatrixAxes = (
  availableGroups: string[],
): {
  row: MatrixAxisConfig;
  column: MatrixAxisConfig;
} => {
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

export const useAnalysisPanelController = ({
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
}: UseAnalysisPanelControllerParams): AnalysisPanelViewProps => {
  const { settings } = useSettings();
  const notification = useNotification();
  const exportTargetRef = useRef<HTMLDivElement | null>(null);

  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [matrixFilters, setMatrixFilters] = useState<MatrixFilterState>(
    createDefaultMatrixFilters(),
  );

  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );
  const [matrixAxes, setMatrixAxes] = useState<{
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }>(() => getInitialMatrixAxes(availableGroups));

  useEffect(() => {
    setMatrixAxes(getInitialMatrixAxes(availableGroups));
  }, [availableGroups]);

  const createMomentumData = useMemo(
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

  return {
    open,
    onClose,
    currentView,
    onChangeView,
    hasTimelineData,
    resolvedTeamNames,
    timeline,
    onJumpToSegment,
    embedded,
    isSyncing,
    onCreateAiPlaylist,
    dashboardFilters,
    onDashboardFiltersChange: setDashboardFilters,
    matrixAxes,
    onMatrixAxesChange: setMatrixAxes,
    matrixFilters,
    onMatrixFiltersChange: setMatrixFilters,
    createMomentumData,
    exportTargetRef,
    exportAnchor,
    setExportAnchor,
    isExporting,
    onCloseExportMenu: closeExportMenu,
    onCopySummary: handleCopySummary,
    onExportPng: handleExportPng,
    onExportPdf: handleExportPdf,
  };
};
