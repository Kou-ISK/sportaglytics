import React from 'react';
import { Box, Dialog, DialogContent, DialogTitle, Tab, Tabs } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { AnalysisView } from '../AnalysisPanel';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import { TAB_DEFINITIONS, ACTIONS_TO_SUMMARISE } from './constants';
import { PossessionTab } from './PossessionTab';
import { ActionBreakdownTab } from './ActionBreakdownTab';
import { MomentumTab } from './MomentumTab';
import { MatrixTab } from './MatrixTab';
import { CustomChartTab } from './CustomChartTab';
import { DashboardTab } from './DashboardTab';
import { AnalysisPanelHeader } from './AnalysisPanelHeader';

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
  possessionData,
  hasTimelineData,
  resolvedTeamNames,
  countActionResultByTeamName,
  countActionTypeByTeamName,
  createMomentumData,
  timeline,
  onJumpToSegment,
  embedded = false,
}: AnalysisPanelViewProps) => {
  const content = (
    <>
      <Tabs
        value={currentView}
        onChange={(_event, value) => onChangeView(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        {TAB_DEFINITIONS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
          />
        ))}
      </Tabs>

      {currentView === 'possession' && (
        <PossessionTab
          hasData={hasTimelineData}
          data={possessionData}
          emptyMessage="ポゼッションを算出するためのタイムラインがまだありません。"
        />
      )}

      {currentView === 'results' && (
        <ActionBreakdownTab
          hasData={hasTimelineData}
          actions={ACTIONS_TO_SUMMARISE}
          teamNames={resolvedTeamNames}
          countActionFunction={countActionResultByTeamName}
          titleFormatter={(actionName) => `${actionName} の結果別割合`}
          emptyMessage="アクションの結果を表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'types' && (
        <ActionBreakdownTab
          hasData={hasTimelineData}
          actions={ACTIONS_TO_SUMMARISE}
          teamNames={resolvedTeamNames}
          countActionFunction={countActionTypeByTeamName}
          titleFormatter={(actionName) => `${actionName} の種別別内訳`}
          emptyMessage="アクション種別を表示するにはタイムラインを作成してください。"
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

      {currentView === 'matrix' && (
        <MatrixTab
          hasData={hasTimelineData}
          timeline={timeline}
          onJumpToSegment={onJumpToSegment}
          emptyMessage="クロス集計を表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'dashboard' && (
        <DashboardTab
          hasData={hasTimelineData}
          timeline={timeline}
          teamNames={resolvedTeamNames}
          emptyMessage="ダッシュボードを表示するにはタイムラインを作成してください。"
        />
      )}

      {currentView === 'custom' && (
        <CustomChartTab
          hasData={hasTimelineData}
          timeline={timeline}
          emptyMessage="カスタムチャートを表示するにはタイムラインを作成してください。"
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
