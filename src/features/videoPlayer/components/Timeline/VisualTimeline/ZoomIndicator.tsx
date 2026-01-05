import React from 'react';
import { Box, Typography } from '@mui/material';

interface ZoomIndicatorProps {
  zoomScale: number;
}

export const ZoomIndicator: React.FC<ZoomIndicatorProps> = ({ zoomScale }) => {
  if (zoomScale === 1) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        bgcolor: 'background.paper',
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <Typography variant="caption">
        Zoom: {(zoomScale * 100).toFixed(0)}%
      </Typography>
    </Box>
  );
};
