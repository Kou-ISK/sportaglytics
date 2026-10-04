import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import { OnboardingTutorialView } from '../patterns/OnboardingTutorialView';
import type {
  OnboardingTutorialViewProps,
  TutorialStep,
} from '../patterns/OnboardingTutorialView';

const steps: TutorialStep[] = [
  {
    title: 'SporTagLyticsへようこそ',
    description: '映像を開き、場面を記録して分析します。',
    icon: <TimelineIcon />,
  },
  {
    title: 'パッケージを開く',
    description: '既存のパッケージを開くか、新規作成します。',
    icon: <TimelineIcon />,
    tips: [
      'パッケージをドロップして開けます',
      '最近使ったパッケージは履歴から再開できます',
    ],
  },
  {
    title: '統計を可視化',
    description: '記録した場面をチャートとクロス集計で確認します。',
    icon: <TimelineIcon />,
    tips: ['チャートから該当場面を確認できます'],
  },
];
const InteractiveTutorial = (
  props: OnboardingTutorialViewProps,
): ReactElement => {
  const [activeStep, setActiveStep] = useState(props.activeStep);
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button
        onClick={() => {
          setActiveStep(0);
          setOpen(true);
        }}
      >
        操作ガイドを開く
      </Button>
      <OnboardingTutorialView
        {...props}
        open={open}
        activeStep={activeStep}
        currentStep={steps[activeStep]}
        onBack={() => setActiveStep((step) => Math.max(0, step - 1))}
        onNext={() =>
          activeStep === steps.length - 1
            ? setOpen(false)
            : setActiveStep((step) => step + 1)
        }
        onSkip={() => setOpen(false)}
      />
    </>
  );
};
const meta = {
  title: 'Workspace/Onboarding',
  component: OnboardingTutorialView,
  render: (args) => <InteractiveTutorial {...args} />,
  args: {
    open: true,
    activeStep: 0,
    stepsCount: steps.length,
    currentStep: steps[0],
    onNext: () => {},
    onBack: () => {},
    onSkip: () => {},
  },
} satisfies Meta<typeof OnboardingTutorialView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Welcome: Story = {};
export const WithTips: Story = { args: { activeStep: 1 } };
export const LastStep: Story = { args: { activeStep: 2 } };
export const Light: Story = { globals: { themeMode: 'light' } };
