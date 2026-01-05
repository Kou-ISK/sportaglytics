import React, { useState, useEffect } from 'react';
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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TimelineIcon from '@mui/icons-material/Timeline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips?: string[];
}

export const ONBOARDING_STORAGE_KEY = 'sportaglytics-onboarding-completed';

const tutorialSteps: TutorialStep[] = [
  {
    title: 'SporTagLyticsへようこそ',
    description:
      '映像分析を効率化するための強力なツールです。このチュートリアルでは、主要な機能を簡単にご紹介します。',
    icon: <TimelineIcon sx={{ fontSize: 80, color: 'primary.main' }} />,
  },
  {
    title: 'パッケージを開く',
    description:
      'まず、分析したい試合の映像パッケージを選択します。既存のパッケージを開くか、新規作成できます。',
    icon: <FolderOpenIcon sx={{ fontSize: 80, color: 'primary.main' }} />,
    tips: [
      'ドラッグ&ドロップでパッケージフォルダを開けます',
      '最近使ったパッケージは履歴に表示されます',
    ],
  },
  {
    title: 'タイムラインでタグ付け',
    description:
      '映像を見ながら、プレーをタイムラインにタグ付けします。アクションボタンで素早く記録できます。',
    icon: <TimelineIcon sx={{ fontSize: 80, color: 'secondary.main' }} />,
    tips: [
      '右クリックでタイムラインアイテムを編集・削除',
      '矢印キー（↑↓）でアイテムを移動',
    ],
  },
  {
    title: '統計を可視化',
    description:
      'タグ付けしたデータから、ポゼッション、アクション結果、モメンタムなどの統計を自動生成します。',
    icon: <BarChartIcon sx={{ fontSize: 80, color: 'secondary.main' }} />,
    tips: ['チャートをクリックして詳細を確認', '統計は自動保存されます'],
  },
];

export const OnboardingTutorial: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // LocalStorageから完了フラグを確認
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      // 少し遅延させてから表示（UIが落ち着いてから）
      const timer = setTimeout(() => {
        setOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (activeStep < tutorialSteps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setOpen(false);
  };

  const currentStep = tutorialSteps[activeStep];

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
        onClick={handleSkip}
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
          {/* アイコン */}
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

          {/* タイトル */}
          <Typography
            variant="h5"
            fontWeight="bold"
            textAlign="center"
            sx={{ color: 'primary.main' }}
          >
            {currentStep.title}
          </Typography>

          {/* 説明 */}
          <Typography
            variant="body1"
            textAlign="center"
            color="text.secondary"
            sx={{ maxWidth: 450 }}
          >
            {currentStep.description}
          </Typography>

          {/* Tips */}
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
                💡 Tips
              </Typography>
              <Stack spacing={0.5}>
                {currentStep.tips.map((tip) => (
                  <Typography
                    key={tip}
                    variant="body2"
                    color="text.secondary"
                    sx={{ pl: 1 }}
                  >
                    • {tip}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          )}

          {/* ステッパー */}
          <MobileStepper
            variant="dots"
            steps={tutorialSteps.length}
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
                onClick={handleNext}
                variant={
                  activeStep === tutorialSteps.length - 1
                    ? 'contained'
                    : 'outlined'
                }
                endIcon={
                  activeStep === tutorialSteps.length - 1 ? null : (
                    <ArrowForwardIcon />
                  )
                }
              >
                {activeStep === tutorialSteps.length - 1 ? '始める' : '次へ'}
              </Button>
            }
            backButton={
              <Button
                size="large"
                onClick={handleBack}
                disabled={activeStep === 0}
                startIcon={<ArrowBackIcon />}
              >
                戻る
              </Button>
            }
          />

          {/* スキップボタン */}
          {activeStep < tutorialSteps.length - 1 && (
            <Button
              onClick={handleSkip}
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
