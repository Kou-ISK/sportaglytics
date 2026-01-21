import React from 'react';
import { Box, Button, Stack } from '@mui/material';

type WizardFooterProps = {
  activeStep: number;
  totalSteps: number;
  isAnalyzing: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
};

export const WizardFooter = ({
  activeStep,
  totalSteps,
  isAnalyzing,
  onCancel,
  onBack,
  onNext,
}: WizardFooterProps) => {
  return (
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
      <Button onClick={onCancel} disabled={isAnalyzing}>
        キャンセル
      </Button>
      <Box sx={{ flex: 1 }} />
      {activeStep > 0 && (
        <Button onClick={onBack} disabled={isAnalyzing}>
          戻る
        </Button>
      )}
      <Button variant="contained" onClick={onNext} disabled={isAnalyzing}>
        {activeStep === totalSteps - 1 ? '作成' : '次へ'}
      </Button>
    </Stack>
  );
};
