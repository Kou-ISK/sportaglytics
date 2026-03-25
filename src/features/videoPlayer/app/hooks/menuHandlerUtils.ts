import type { AnalysisView } from '../../../../types/AnalysisView';

const isAnalysisView = (requested: unknown): requested is AnalysisView => {
  return (
    requested === 'dashboard' ||
    requested === 'momentum' ||
    requested === 'matrix' ||
    requested === 'ai'
  );
};

export const resolveRequestedAnalysisView = (
  requested: unknown,
): AnalysisView => {
  return isAnalysisView(requested) ? requested : 'dashboard';
};

export const safeMenuCleanup = (cleanup: () => void): void => {
  try {
    cleanup();
  } catch (error: unknown) {
    console.debug('menu event cleanup error', error);
  }
};
