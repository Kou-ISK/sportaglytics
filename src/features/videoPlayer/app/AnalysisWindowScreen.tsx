import React from 'react';
import { Box } from '@mui/material';
import { AnalysisPanel } from '..';
import { useAnalysisWindowController } from './hooks/useAnalysisWindowController';

export const AnalysisWindowScreen = () => {
  const {
    timeline,
    teamNames,
    analysisView,
    isSyncing,
    setAnalysisView,
    handleClose,
    handleJumpToSegment,
    handleCreateAiPlaylist,
  } = useAnalysisWindowController();

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
        isSyncing={isSyncing}
        onCreateAiPlaylist={handleCreateAiPlaylist}
      />
    </Box>
  );
};
