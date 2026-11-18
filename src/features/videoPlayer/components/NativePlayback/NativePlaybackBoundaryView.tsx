import type { ReactElement, ReactNode } from 'react';
import { Alert, Box } from '@mui/material';

export const NativePlaybackBoundaryView = ({
  children,
  warning,
}: {
  children: ReactNode;
  warning?: string | null;
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
    {warning && <Alert severity="warning">{warning}</Alert>}
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
  </Box>
);
