import React from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';

interface DashboardWidgetPresetSectionProps {
  onApplyPreset: (mode: 'labelPie' | 'compareBar' | 'seriesPie') => void;
}

export const DashboardWidgetPresetSection = ({
  onApplyPreset,
}: DashboardWidgetPresetSectionProps) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            1. 何を見たいか（テンプレート）
          </Typography>
          <Typography variant="caption" color="text.secondary">
            よく使う形を選んでから、必要に応じて詳細を調整します。
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" size="small" onClick={() => onApplyPreset('labelPie')}>
            ラベル比率（円）
          </Button>
          <Button variant="outlined" size="small" onClick={() => onApplyPreset('compareBar')}>
            件数比較（バー）
          </Button>
          <Button variant="outlined" size="small" onClick={() => onApplyPreset('seriesPie')}>
            条件比較（円）
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
