import React from 'react';
import { OnboardingTutorialView } from './OnboardingTutorialView';
import { useOnboardingTutorialController } from './useOnboardingTutorialController';

export const OnboardingTutorial: React.FC = () => {
  const {
    handleBack,
    handleNext,
    handleSkip,
    ...viewProps
  } = useOnboardingTutorialController();

  return (
    <OnboardingTutorialView
      {...viewProps}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={handleSkip}
    />
  );
};
