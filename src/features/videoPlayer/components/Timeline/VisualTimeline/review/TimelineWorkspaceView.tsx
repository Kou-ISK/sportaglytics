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
      containerType: 'inline-size',
    }}
  >
    {review.open && (
      <Box
        sx={{
          width: 320,
          maxWidth: '42%',
          flexShrink: 0,
          minHeight: 0,
          borderRight: 1,
          borderColor: 'divider',
          '@container (max-width: 880px)': { width: '100%', maxWidth: '100%' },
        }}
      >
        <TimelineReviewView {...review} />
      </Box>
    )}
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        '@container (max-width: 880px)': {
          display: review.open ? 'none' : 'block',
        },
      }}
    >
      {children}
    </Box>
  </Box>
);
