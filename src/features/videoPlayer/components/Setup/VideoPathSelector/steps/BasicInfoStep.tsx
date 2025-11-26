import React from 'react';
import { Alert, AlertTitle, Stack, TextField } from '@mui/material';
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
    <Stack spacing={3}>
      <Alert severity="info">
        <AlertTitle>パッケージの基本情報を入力してください</AlertTitle>
        パッケージ名と対戦する2チームの名前を入力します
      </Alert>

      <TextField
        fullWidth
        label="パッケージ名"
        value={form.packageName}
        onChange={(event) => onChange({ packageName: event.target.value })}
        error={!!errors.packageName}
        helperText={errors.packageName || '例: 2024_春季大会_決勝'}
        required
      />

      <TextField
        fullWidth
        label="チーム名 (1)"
        value={form.team1Name}
        onChange={(event) => onChange({ team1Name: event.target.value })}
        error={!!errors.team1Name}
        helperText={errors.team1Name || '赤色で表示されます'}
        required
      />

      <TextField
        fullWidth
        label="チーム名 (2)"
        value={form.team2Name}
        onChange={(event) => onChange({ team2Name: event.target.value })}
        error={!!errors.team2Name}
        helperText={errors.team2Name || '青色で表示されます'}
        required
      />
    </Stack>
  );
};
