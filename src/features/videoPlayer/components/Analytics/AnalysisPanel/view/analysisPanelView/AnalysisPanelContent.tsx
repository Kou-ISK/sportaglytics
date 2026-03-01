import React from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import type { AnalysisView } from '../../../../../../../types/AnalysisView';
import type { CreateMomentumDataFn } from '../../../../../../../types/Analysis';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type { DashboardSeriesFilter } from '../../../../../../../types/Settings';
import type { MatrixFilterState } from '../hooks/matrixFilterUtils';
import type { PlaylistItem } from '../../../../../../../types/Playlist';
import { AIAnalysisTab } from '../AIAnalysisTab';
import { DashboardTab } from '../DashboardTab';
import { MatrixTab } from '../MatrixTab';
import { MomentumTab } from '../MomentumTab';

interface AnalysisPanelContentProps {
  currentView: AnalysisView;
  isSyncing: boolean;
  hasTimelineData: boolean;
  timeline: TimelineData[];
  resolvedTeamNames: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
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
}

export const AnalysisPanelContent = ({
  currentView,
  isSyncing,
  hasTimelineData,
  timeline,
  resolvedTeamNames,
  onJumpToSegment,
  onCreateAiPlaylist,
  dashboardFilters,
  onDashboardFiltersChange,
  matrixAxes,
  onMatrixAxesChange,
  matrixFilters,
  onMatrixFiltersChange,
  createMomentumData,
}: AnalysisPanelContentProps) => {
  return (
    <>
      {isSyncing && !hasTimelineData && (
        <Stack
          spacing={1}
          sx={{
            p: 4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            タイムラインを同期中です...
          </Typography>
        </Stack>
      )}

      {!isSyncing && currentView === 'dashboard' && (
        <DashboardTab
          hasData={hasTimelineData}
          timeline={timeline}
          teamNames={resolvedTeamNames}
          emptyMessage="ダッシュボードを表示するにはタイムラインを作成してください。"
          onJumpToSegment={onJumpToSegment}
          dashboardFilters={dashboardFilters}
          onDashboardFiltersChange={onDashboardFiltersChange}
        />
      )}

      {!isSyncing && currentView === 'matrix' && (
        <MatrixTab
          hasData={hasTimelineData}
          timeline={timeline}
          onJumpToSegment={onJumpToSegment}
          emptyMessage="クロス集計を表示するにはタイムラインを作成してください。"
          totalTimelineCount={timeline.length}
          matrixAxes={matrixAxes}
          onMatrixAxesChange={onMatrixAxesChange}
          matrixFilters={matrixFilters}
          onMatrixFiltersChange={onMatrixFiltersChange}
        />
      )}

      {!isSyncing && currentView === 'momentum' && (
        <MomentumTab
          hasData={hasTimelineData}
          createMomentumData={createMomentumData}
          teamNames={resolvedTeamNames}
          timeline={timeline}
          emptyMessage="モメンタムを表示するにはタイムラインを作成してください。"
          onJumpToSegment={onJumpToSegment}
        />
      )}

      {!isSyncing && currentView === 'ai' && (
        <AIAnalysisTab
          hasData={hasTimelineData}
          timeline={timeline}
          emptyMessage="AI分析を表示するにはタイムラインを作成してください。"
          onCreateAiPlaylist={onCreateAiPlaylist}
          onJumpToSegment={onJumpToSegment}
          totalTimelineCount={timeline.length}
        />
      )}
    </>
  );
};
