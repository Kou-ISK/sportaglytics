import React from 'react';
import { Chip } from '@mui/material';
import LabelIcon from '@mui/icons-material/Label';

type CodePanelModeIndicatorProps = {
  activeMode: 'code' | 'label';
};

export const CodePanelModeIndicator = ({
  activeMode,
}: CodePanelModeIndicatorProps) => {
  if (activeMode !== 'label') return null;

  return (
    <Chip
      icon={<LabelIcon />}
      label="ラベルモード"
      size="small"
      color="secondary"
      variant="outlined"
    />
  );
};
