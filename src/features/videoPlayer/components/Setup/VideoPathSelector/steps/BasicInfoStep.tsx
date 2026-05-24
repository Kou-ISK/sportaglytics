import React from 'react';
import { Stack, TextField, Typography } from '@mui/material';
import type { WizardFormState } from '../types';

interface BasicInfoStepProps {
  form: WizardFormState;
  errors: Partial<WizardFormState>;
  onChange: (updates: Partial<WizardFormState>) => void;
}

/**
 * Step 1: パッケージ名とチーム名の入力
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  form,
  errors,
  onChange,
}) => {
  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle1" fontWeight={700}>
        詳細
      </Typography>

      <TextField
        fullWidth
        label="パッケージ"
        value={form.packageName}
        onChange={(event) => onChange({ packageName: event.target.value })}
        error={!!errors.packageName}
        helperText={errors.packageName || '例: 2024_final'}
        required
      />

      <TextField
        fullWidth
        label="Team 1"
        value={form.team1Name}
        onChange={(event) => onChange({ team1Name: event.target.value })}
        error={!!errors.team1Name}
        helperText={errors.team1Name || ' '}
        required
      />

      <TextField
        fullWidth
        label="Team 2"
        value={form.team2Name}
        onChange={(event) => onChange({ team2Name: event.target.value })}
        error={!!errors.team2Name}
        helperText={errors.team2Name || ' '}
        required
      />
    </Stack>
  );
};
