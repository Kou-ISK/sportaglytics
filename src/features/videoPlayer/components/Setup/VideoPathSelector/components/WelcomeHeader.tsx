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
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 1,
      }}
    />
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h6"
        component="h1"
        sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}
      >
        SporTagLytics
      </Typography>
      {show && (
        <Typography variant="body2" color="text.secondary">
          映像を開いて、場面を記録・分析
        </Typography>
      )}
    </Box>
  </Stack>
);
