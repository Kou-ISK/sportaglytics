import React, { useMemo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { MomentumChart } from '../../videoPlayer';
import type { AnalysisReportPayload } from '../../../report/types';
import { chunkMomentumSegments } from '../utils/reportTransforms';

interface MomentumSectionsReportProps {
  payload: AnalysisReportPayload;
}

export const MomentumSectionsReport = ({ payload }: MomentumSectionsReportProps) => {
  const momentumChunks = useMemo(
    () => chunkMomentumSegments(payload.momentum.segments),
    [payload.momentum.segments],
  );

  return (
    <>
      {momentumChunks.map((chunk, index) => (
        <Paper
          key={`momentum-${index + 1}`}
          className="analysis-report-sheet analysis-report-page-break"
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
        >
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            {payload.momentum.title} ({index + 1}/{momentumChunks.length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Teams: {payload.momentum.teamNames.join(' / ')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Segments: {chunk.length}
          </Typography>
          {payload.momentum.summary ? (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {payload.momentum.summary}
            </Typography>
          ) : null}
          <Box sx={{ mt: 1.25, overflow: 'hidden' }}>
            <MomentumChart
              createMomentumData={() => chunk}
              teamNames={payload.momentum.teamNames}
              disableAnimation
              renderMode="print"
            />
          </Box>
        </Paper>
      ))}
    </>
  );
};
