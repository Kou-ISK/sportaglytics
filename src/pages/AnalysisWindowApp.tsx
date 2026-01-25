import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { StatsPanel, StatsView } from '../features/videoPlayer/components/Analytics/StatsPanel/StatsPanel';
import type { TimelineData } from '../types/TimelineData';
import type { AnalysisWindowSyncPayload } from '../renderer';

export const AnalysisWindowApp = () => {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [statsView, setStatsView] = useState<StatsView>('dashboard');

  useEffect(() => {
    const api = window.electronAPI?.analysis;
    if (!api?.onSync) return;

    const handleSync = (payload: AnalysisWindowSyncPayload) => {
      if (!payload) return;
      setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
      setTeamNames(Array.isArray(payload.teamNames) ? payload.teamNames : []);
      if (payload.view) setStatsView(payload.view);
    };

    api.onSync(handleSync);
    return () => api.offSync?.(handleSync);
  }, []);

  const handleClose = useCallback(() => {
    const api = window.electronAPI?.analysis;
    if (api?.closeWindow) {
      api.closeWindow();
    } else {
      window.close();
    }
  }, []);

  const handleJumpToSegment = useCallback((segment: TimelineData) => {
    window.electronAPI?.analysis?.sendJumpToSegment(segment);
  }, []);

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default' }}>
      <StatsPanel
        open
        onClose={handleClose}
        view={statsView}
        onViewChange={setStatsView}
        timeline={timeline}
        teamNames={teamNames}
        onJumpToSegment={handleJumpToSegment}
        embedded
      />
    </Box>
  );
};
