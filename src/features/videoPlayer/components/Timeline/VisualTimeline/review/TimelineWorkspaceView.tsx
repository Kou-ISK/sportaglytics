import type { ReactElement, ReactNode } from 'react';
import { Box } from '@mui/material';
import { TimelineReviewView } from './TimelineReviewView';
import type { TimelineReviewViewProps } from './TimelineReviewView';

export const TimelineWorkspaceView = ({
  review,
  children,
}: {
  review: TimelineReviewViewProps;
  children: ReactNode;
}): ReactElement => (
  <Box
    sx={{
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      containerType: 'inline-size',
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0, minHeight: review.open ? 100 : 0 }}>
      {children}
    </Box>
    {review.open && (
      <Box
        sx={{
          height: '48%',
          maxHeight: 220,
          minHeight: 76,
          flexShrink: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <TimelineReviewView {...review} />
      </Box>
    )}
  </Box>
);
