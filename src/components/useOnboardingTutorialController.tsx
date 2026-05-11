import { useCallback, useEffect, useState } from 'react';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TimelineIcon from '@mui/icons-material/Timeline';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { TutorialStep } from './OnboardingTutorialView';
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
} from '../shared/onboarding/onboardingStorage';

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

const OPEN_DELAY_MS = 500;

interface OnboardingTutorialController {
  open: boolean;
  activeStep: number;
  stepsCount: number;
  currentStep: TutorialStep;
  handleNext: () => void;
  handleBack: () => void;
  handleSkip: () => void;
}

export const useOnboardingTutorialController =
  (): OnboardingTutorialController => {
    const [open, setOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
      if (isOnboardingCompleted()) {
        return;
      }

      const timer = globalThis.setTimeout(() => {
        setOpen(true);
      }, OPEN_DELAY_MS);

      return () => {
        globalThis.clearTimeout(timer);
      };
    }, []);

    const handleClose = useCallback(() => {
      markOnboardingCompleted();
      setOpen(false);
    }, []);

    const handleNext = useCallback(() => {
      if (activeStep < tutorialSteps.length - 1) {
        setActiveStep((prev) => prev + 1);
        return;
      }

      handleClose();
    }, [activeStep, handleClose]);

    const handleBack = useCallback(() => {
      setActiveStep((prev) => Math.max(0, prev - 1));
    }, []);

    return {
      open,
      activeStep,
      stepsCount: tutorialSteps.length,
      currentStep: tutorialSteps[activeStep],
      handleNext,
      handleBack,
      handleSkip: handleClose,
    };
  };
