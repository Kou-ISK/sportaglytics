import type { ReactElement } from 'react';
import { Box, Stack, Typography } from '@mui/material';
export const WelcomeHeader = ({ show }: { show: boolean }): ReactElement => (
  <Stack direction="row" spacing={1.5} alignItems="center">
    <Box
      component="img"
      src={`${import.meta.env.BASE_URL}icon.png`}
      alt="SporTagLytics アプリロゴ"
      sx={{
        objectFit: 'contain',
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 1.5,
      }}
    />
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h5"
        component="h1"
        sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}
      >
        SporTagLytics
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {show
          ? '試合映像から、分析を始めましょう。'
          : '分析の続きを、ここから。'}
      </Typography>
    </Box>
  </Stack>
);
