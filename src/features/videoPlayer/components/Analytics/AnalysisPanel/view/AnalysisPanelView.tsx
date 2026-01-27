import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { AnalysisView } from '../AnalysisPanel';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import { AnalysisPanelHeader } from './AnalysisPanelHeader';
import { MomentumTab } from './MomentumTab';
import { AIAnalysisTab } from './AIAnalysisTab';
import { DashboardTab } from './DashboardTab';
import { MatrixTab } from './MatrixTab';

interface AnalysisPanelViewProps extends AnalysisPanelDerivedState {
  open: boolean;
  onClose: () => void;
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
}

export const AnalysisPanelView = ({
  open,
  onClose,
  currentView,
  onChangeView,
  hasTimelineData,
  resolvedTeamNames,
  createMomentumData,
  timeline,
  onJumpToSegment,
  embedded = false,
}: AnalysisPanelViewProps) => {
  const content = (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <ToggleButtonGroup
          value={currentView}
          exclusive
          onChange={(_event, value) => {
            if (value) onChangeView(value);
          }}
          size="small"
        >
          <ToggleButton value="dashboard">ダッシュボード</ToggleButton>
          <ToggleButton value="momentum">モメンタム</ToggleButton>
          <ToggleButton value="matrix">クロス集計</ToggleButton>
          <ToggleButton value="ai">AI分析</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {currentView === 'dashboard' && (
        <DashboardTab
          hasData={hasTimelineData}
          timeline={timeline}
          teamNames={resolvedTeamNames}
          emptyMessage="ダッシュボードを表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'matrix' && (
        <MatrixTab
          hasData={hasTimelineData}
          timeline={timeline}
          onJumpToSegment={onJumpToSegment}
          emptyMessage="クロス集計を表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'momentum' && (
        <MomentumTab
          hasData={hasTimelineData}
          createMomentumData={createMomentumData}
          teamNames={resolvedTeamNames}
          emptyMessage="モメンタムを表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'ai' && (
        <AIAnalysisTab
          hasData={hasTimelineData}
          timeline={timeline}
          teamNames={resolvedTeamNames}
          emptyMessage="AI分析を表示するにはタイムラインを作成してください。"
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
        <Box sx={{ mb: 2 }}>
          <AnalysisPanelHeader onClose={onClose} />
        </Box>
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
      aria-labelledby="stats-dialog-title"
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogTitle id="stats-dialog-title" sx={{ pb: 1 }}>
        <AnalysisPanelHeader onClose={onClose} />
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 0 }}>
        {content}
      </DialogContent>
    </Dialog>
  );
};
