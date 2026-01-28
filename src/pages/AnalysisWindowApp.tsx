import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { AnalysisPanel, AnalysisView } from '../features/videoPlayer/components/Analytics/AnalysisPanel/AnalysisPanel';
import type { TimelineData } from '../types/TimelineData';
import type { PlaylistItem } from '../types/Playlist';
import type { AnalysisWindowSyncPayload } from '../renderer';

export const AnalysisWindowApp = () => {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [analysisView, setAnalysisView] = useState<AnalysisView>('dashboard');

  useEffect(() => {
    const api = window.electronAPI?.analysis;
    if (!api?.onSync) return;

    const handleSync = (payload: AnalysisWindowSyncPayload) => {
      if (!payload) return;
      setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
      setTeamNames(Array.isArray(payload.teamNames) ? payload.teamNames : []);
      if (payload.view) setAnalysisView(payload.view);
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

  const handleCreateAiPlaylist = useCallback(
    async (payload: { name: string; items: PlaylistItem[] }) => {
      if (!window.electronAPI?.analysis?.sendCreateAiPlaylist) return;
      window.electronAPI.analysis.sendCreateAiPlaylist(payload);
    },
    [],
  );

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default' }}>
      <AnalysisPanel
        open
        onClose={handleClose}
        view={analysisView}
        onViewChange={setAnalysisView}
        timeline={timeline}
        teamNames={teamNames}
        onJumpToSegment={handleJumpToSegment}
        embedded
        onCreateAiPlaylist={handleCreateAiPlaylist}
      />
    </Box>
  );
};
