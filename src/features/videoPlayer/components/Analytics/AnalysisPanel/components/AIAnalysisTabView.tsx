import React from 'react';
import { Box } from '@mui/material';
import type { AIAnalysisTabViewProps } from './AIAnalysisTabView.types';
import { AIAnalysisMainColumn } from './AIAnalysisMainColumn';
import { AIAnalysisSidebarColumn } from './AIAnalysisSidebarColumn';
import { NoDataPlaceholder } from './NoDataPlaceholder';

export const AIAnalysisTabView = ({
  hasData,
  timeline,
  emptyMessage,
  ...props
}: AIAnalysisTabViewProps): React.JSX.Element => {
  if (!hasData || timeline.length === 0) {
    if (!hasData) {
      return <NoDataPlaceholder message={emptyMessage} />;
    }
    return <NoDataPlaceholder message="表示できるタイムラインがありません。" />;
  }

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}
      gap={2}
    >
      <AIAnalysisMainColumn
        hasData={hasData}
        timeline={timeline}
        emptyMessage={emptyMessage}
        {...props}
      />
      <AIAnalysisSidebarColumn
        hasData={hasData}
        timeline={timeline}
        emptyMessage={emptyMessage}
        {...props}
      />
    </Box>
  );
};
