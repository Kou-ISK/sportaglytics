import React from 'react';
import { Box, Typography } from '@mui/material';

interface NoDataPlaceholderProps {
  message: string;
}

export const NoDataPlaceholder = ({
  message,
}: NoDataPlaceholderProps): React.JSX.Element => (
  <Box
    sx={{
      py: 2,
      px: 0,
      minWidth: 0,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);
