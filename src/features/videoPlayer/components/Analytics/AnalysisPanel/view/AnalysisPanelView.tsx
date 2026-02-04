import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridOnIcon from '@mui/icons-material/GridOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { AnalysisView } from '../AnalysisPanel';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import { MomentumTab } from './MomentumTab';
import { AIAnalysisTab } from './AIAnalysisTab';
import { DashboardTab } from './DashboardTab';
import { MatrixTab } from './MatrixTab';
import type { PlaylistItem } from '../../../../../../types/Playlist';

interface AnalysisPanelViewProps extends AnalysisPanelDerivedState {
  open: boolean;
  onClose: () => void;
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
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
  onCreateAiPlaylist,
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
        <ToggleButtonGroup
          value={currentView}
          exclusive
          onChange={(_event, value) => {
            if (value) onChangeView(value);
          }}
          size="small"
        >
          <ToggleButton value="dashboard">
            <DashboardIcon fontSize="small" sx={{ mr: 0.5 }} />
            ダッシュボード
          </ToggleButton>
          <ToggleButton value="momentum">
            <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
            モメンタム
          </ToggleButton>
          <ToggleButton value="matrix">
            <GridOnIcon fontSize="small" sx={{ mr: 0.5 }} />
            クロス集計
          </ToggleButton>
          <ToggleButton value="ai">
            <AutoAwesomeIcon fontSize="small" sx={{ mr: 0.5 }} />
            AI分析
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
            emptyMessage="AI分析を表示するにはタイムラインを作成してください。"
            onCreateAiPlaylist={onCreateAiPlaylist}
            onJumpToSegment={onJumpToSegment}
          />
        )}
      </Box>
    </Box>
  );

  if (embedded) {
    return (
      <Box
        sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
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
