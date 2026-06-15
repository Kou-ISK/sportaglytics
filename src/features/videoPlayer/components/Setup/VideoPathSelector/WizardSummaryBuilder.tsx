import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { WizardFormState, WizardSelectionState } from './types';

export interface WizardSummaryItem {
  label: string;
  value: React.ReactNode;
}

const renderTeams = (form: WizardFormState): React.ReactNode => {
  return (
    <Stack direction="row" spacing={1}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'error.light',
          color: 'error.contrastText',
          fontSize: '0.75rem',
        }}
      >
        {form.team1Name}
      </Box>
      <Typography variant="body2">vs</Typography>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'primary.light',
          color: 'primary.contrastText',
          fontSize: '0.75rem',
        }}
      >
        {form.team2Name}
      </Box>
    </Stack>
  );
};

const renderAngles = (selection: WizardSelectionState): React.ReactNode => {
  return (
    <Stack spacing={1}>
      {selection.angles.map((angle, index) => {
        const fileName = angle.filePath ? angle.filePath.split('/').pop() : '未選択';
        const roleLabel =
          index === 0 ? 'メイン (自動)' : index === 1 ? 'セカンダリ (自動)' : '';
        return (
          <Stack key={angle.id} direction="row" spacing={1}>
            <Typography variant="body2" sx={{ minWidth: 110 }}>
              {angle.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fileName}
            </Typography>
            {roleLabel && (
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: roleLabel.includes('メイン')
                    ? 'primary.main'
                    : 'info.main',
                  color: 'primary.contrastText',
                  fontSize: '0.75rem',
                }}
              >
                {roleLabel}
              </Box>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
};

export const buildWizardSummaryItems = (
  form: WizardFormState,
  selection: WizardSelectionState,
): WizardSummaryItem[] => {
  return [
    { label: 'パッケージ名', value: form.packageName },
    { label: 'チーム', value: renderTeams(form) },
    { label: '保存先', value: selection.selectedDirectory },
    { label: 'アングル設定', value: renderAngles(selection) },
  ];
};
