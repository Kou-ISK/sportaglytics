import React from 'react';
import { Box, Button, Stack } from '@mui/material';

type WizardFooterProps = {
  activeStep: number;
  totalSteps: number;
  isCreating: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
};

export const WizardFooter = ({
  activeStep,
  totalSteps,
  isCreating,
  onCancel,
  onBack,
  onNext,
}: WizardFooterProps) => {
  return (
    <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
      <Button onClick={onCancel} disabled={isCreating}>
        キャンセル
      </Button>
      <Box sx={{ flex: 1 }} />
      {activeStep > 0 && (
        <Button onClick={onBack} disabled={isCreating}>
          戻る
        </Button>
      )}
      <Button variant="contained" onClick={onNext} disabled={isCreating}>
        {isCreating
          ? '作成中...'
          : activeStep === totalSteps - 1
            ? '作成'
            : '次へ'}
      </Button>
    </Stack>
  );
};
