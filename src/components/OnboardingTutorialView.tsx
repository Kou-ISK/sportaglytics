import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Stack,
  MobileStepper,
  IconButton,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips?: string[];
}

interface OnboardingTutorialViewProps {
  open: boolean;
  activeStep: number;
  stepsCount: number;
  currentStep: TutorialStep;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export const OnboardingTutorialView: React.FC<OnboardingTutorialViewProps> = ({
  open,
  activeStep,
  stepsCount,
  currentStep,
  onNext,
  onBack,
  onSkip,
}) => {
  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
        },
      }}
    >
      <IconButton
        onClick={onSkip}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'text.secondary',
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ pt: 6, pb: 3 }}>
        <Stack spacing={3} alignItems="center">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(30, 144, 255, 0.1)'
                  : 'rgba(30, 144, 255, 0.05)',
              border: (theme) =>
                `2px solid ${
                  theme.palette.mode === 'dark'
                    ? 'rgba(30, 144, 255, 0.3)'
                    : 'rgba(30, 144, 255, 0.2)'
                }`,
            }}
          >
            {currentStep.icon}
          </Box>

          <Typography
            variant="h5"
            fontWeight="bold"
            textAlign="center"
            sx={{ color: 'primary.main' }}
          >
            {currentStep.title}
          </Typography>

          <Typography
            variant="body1"
            textAlign="center"
            color="text.secondary"
            sx={{ maxWidth: 450 }}
          >
            {currentStep.description}
          </Typography>

          {currentStep.tips && (
            <Paper
              variant="outlined"
              sx={{
                width: '100%',
                p: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(0, 255, 133, 0.05)'
                    : 'rgba(0, 255, 133, 0.03)',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(0, 255, 133, 0.2)'
                    : 'rgba(0, 255, 133, 0.15)',
              }}
            >
              <Typography
                variant="caption"
                fontWeight="bold"
                sx={{ color: 'secondary.main', mb: 1, display: 'block' }}
              >
                Tips
              </Typography>
              <Stack spacing={0.5}>
                {currentStep.tips.map((tip) => (
                  <Typography
                    key={tip}
                    variant="body2"
                    color="text.secondary"
                    sx={{ pl: 1 }}
                  >
                    {'- '}
                    {tip}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          )}

          <MobileStepper
            variant="dots"
            steps={stepsCount}
            position="static"
            activeStep={activeStep}
            sx={{
              width: '100%',
              bgcolor: 'transparent',
              '& .MuiMobileStepper-dot': {
                bgcolor: 'action.disabled',
              },
              '& .MuiMobileStepper-dotActive': {
                bgcolor: 'primary.main',
              },
            }}
            nextButton={
              <Button
                size="large"
                onClick={onNext}
                variant={activeStep === stepsCount - 1 ? 'contained' : 'outlined'}
                endIcon={activeStep === stepsCount - 1 ? null : <ArrowForwardIcon />}
              >
                {activeStep === stepsCount - 1 ? '始める' : '次へ'}
              </Button>
            }
            backButton={
              <Button
                size="large"
                onClick={onBack}
                disabled={activeStep === 0}
                startIcon={<ArrowBackIcon />}
              >
                戻る
              </Button>
            }
          />

          {activeStep < stepsCount - 1 && (
            <Button
              onClick={onSkip}
              color="inherit"
              size="small"
              sx={{ textTransform: 'none' }}
            >
              スキップ
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
