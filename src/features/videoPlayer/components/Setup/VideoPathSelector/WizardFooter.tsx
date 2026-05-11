import React from 'react';
import { Box, Button, Stack } from '@mui/material';

type WizardFooterProps = {
  activeStep: number;
  totalSteps: number;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
};

export const WizardFooter = ({
  activeStep,
  totalSteps,
  onCancel,
  onBack,
  onNext,
}: WizardFooterProps) => {
  return (
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
      <Button onClick={onCancel}>
        キャンセル
      </Button>
      <Box sx={{ flex: 1 }} />
      {activeStep > 0 && (
        <Button onClick={onBack}>
          戻る
        </Button>
      )}
      <Button variant="contained" onClick={onNext}>
        {activeStep === totalSteps - 1 ? '作成' : '次へ'}
      </Button>
    </Stack>
  );
};
