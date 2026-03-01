import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixAxisSelector } from './MatrixAxisSelector';

interface MatrixAxisEditorProps {
  rowAxis: MatrixAxisConfig;
  columnAxis: MatrixAxisConfig;
  availableGroups: string[];
  onRowAxisChange: (config: MatrixAxisConfig) => void;
  onColumnAxisChange: (config: MatrixAxisConfig) => void;
}

export const MatrixAxisEditor = ({
  rowAxis,
  columnAxis,
  availableGroups,
  onRowAxisChange,
  onColumnAxisChange,
}: MatrixAxisEditorProps) => {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        軸設定
      </Typography>
      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
        <MatrixAxisSelector
          key="row-axis"
          label="行軸"
          value={rowAxis}
          onChange={onRowAxisChange}
          availableGroups={availableGroups}
        />
        <MatrixAxisSelector
          key="column-axis"
          label="列軸"
          value={columnAxis}
          onChange={onColumnAxisChange}
          availableGroups={availableGroups}
        />
      </Box>
    </Stack>
  );
};
