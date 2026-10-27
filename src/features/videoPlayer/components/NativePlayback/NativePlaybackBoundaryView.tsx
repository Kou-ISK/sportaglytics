import type { ReactElement, ReactNode } from 'react';
import { Box } from '@mui/material';

export const NativePlaybackBoundaryView = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <Box
    sx={{
      gridColumn: '1',
      gridRow: '1',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
    }}
  >
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
  </Box>
);
