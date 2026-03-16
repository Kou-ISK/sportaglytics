export const ONBOARDING_STORAGE_KEY = 'sportaglytics-onboarding-completed';

const getStorage = (): Storage | null => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

export const isOnboardingCompleted = (): boolean => {
  return getStorage()?.getItem(ONBOARDING_STORAGE_KEY) === 'true';
};

export const markOnboardingCompleted = (): void => {
  getStorage()?.setItem(ONBOARDING_STORAGE_KEY, 'true');
};
