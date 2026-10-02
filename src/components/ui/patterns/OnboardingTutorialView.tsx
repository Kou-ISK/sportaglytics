import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { IconAction } from '../primitives/IconAction';

export interface TutorialStep {
  title: string;
  description: string;
  icon: ReactNode;
  tips?: string[];
}

export interface OnboardingTutorialViewProps {
  open: boolean;
  activeStep: number;
  stepsCount: number;
  currentStep: TutorialStep;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export const OnboardingTutorialView = ({
  open,
  activeStep,
  stepsCount,
  currentStep,
  onNext,
  onBack,
  onSkip,
}: OnboardingTutorialViewProps): ReactElement => {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Dialog
      open={open}
      onClose={onSkip}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle
        id={titleId}
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Box
          aria-hidden
          sx={{
            display: 'flex',
            '& .MuiSvgIcon-root': { fontSize: 24, color: 'text.secondary' },
          }}
        >
          {currentStep.icon}
        </Box>
        <Typography
          component="span"
          variant="subtitle1"
          fontWeight={700}
          sx={{ flex: 1 }}
        >
          {currentStep.title}
        </Typography>
        <IconAction
          icon={<CloseIcon />}
          label="チュートリアルを閉じる"
          onClick={onSkip}
        />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography id={descriptionId} variant="body2" color="text.secondary">
            {currentStep.description}
          </Typography>
          {currentStep.tips && currentStep.tips.length > 0 && (
            <Box
              component="ul"
              sx={{
                m: 0,
                pl: 2,
                borderTop: 1,
                borderColor: 'divider',
                pt: 1.5,
              }}
            >
              {currentStep.tips.map((tip) => (
                <Typography
                  key={tip}
                  component="li"
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  {tip}
                </Typography>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {activeStep < stepsCount - 1 && (
          <Button onClick={onSkip} color="inherit">
            スキップ
          </Button>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {activeStep + 1} / {stepsCount}
        </Typography>
        <Button
          onClick={onBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBackIcon />}
        >
          戻る
        </Button>
        <Button
          onClick={onNext}
          variant="contained"
          endIcon={
            activeStep === stepsCount - 1 ? undefined : <ArrowForwardIcon />
          }
        >
          {activeStep === stepsCount - 1 ? '始める' : '次へ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
