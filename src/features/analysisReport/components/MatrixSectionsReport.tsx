import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { MatrixSection, NoDataPlaceholder } from '../../videoPlayer';
import type { AnalysisReportPayload } from '../../../report/types';
import {
  fallbackMatrixSections,
  toMatrixCells,
  toSpanMap,
} from '../utils/reportTransforms';

interface MatrixSectionsReportProps {
  payload: AnalysisReportPayload;
}

export const MatrixSectionsReport = ({ payload }: MatrixSectionsReportProps) => {
  const matrixSections = useMemo(() => {
    if (payload.matrix.sections.length > 0) {
      return payload.matrix.sections;
    }
    return fallbackMatrixSections(payload);
  }, [payload]);

  if (matrixSections.length === 0) {
    return (
      <Paper
        className="analysis-report-sheet analysis-report-page-break"
        variant="outlined"
        sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
          {payload.matrix.title}
        </Typography>
        <NoDataPlaceholder message="Matrix summary data is not available." />
        <Typography variant="caption" color="text.secondary">
          {payload.matrix.referenceNote}
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      {matrixSections.map((section, index) => (
        <Paper
          key={`matrix-${section.filterKey}-${index}`}
          className="analysis-report-sheet analysis-report-page-break"
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
        >
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            {payload.matrix.title}: {section.title}
          </Typography>
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Axes: row={payload.matrix.axes.row}, column=
              {payload.matrix.axes.column}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Filters: {payload.matrix.filterSummary}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Visible: {section.visibleCount} / Total: {section.totalCount}
            </Typography>
          </Stack>

          <Box sx={{ mt: 1.25 }}>
            <MatrixSection
              rowHeaders={section.rowHeaders}
              columnHeaders={section.columnHeaders}
              rowParentSpans={toSpanMap(section.rowParentSpans)}
              colParentSpans={toSpanMap(section.colParentSpans)}
              matrix={toMatrixCells(section.values)}
              onDrilldown={() => {
                // Report page is non-interactive.
              }}
              exportMode="print"
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {payload.matrix.referenceNote}
          </Typography>
        </Paper>
      ))}
    </>
  );
};
