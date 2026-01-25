import { useEffect, useCallback } from 'react';
import type { AnalysisView } from '../../../features/videoPlayer/components/Analytics/AnalysisPanel/AnalysisPanel';

interface UseAnalysisMenuHandlersParams {
  onOpenAnalysis: (view: AnalysisView) => void;
}

export const useAnalysisMenuHandlers = ({
  onOpenAnalysis,
}: UseAnalysisMenuHandlersParams) => {
  // useCallbackで安定した関数参照を作成
  const handleMenuAnalysis = useCallback(
    (_event: unknown, requested?: unknown) => {
      const analysisViewOptions: AnalysisView[] = [
        'dashboard',
        'possession',
        'results',
        'types',
        'momentum',
        'matrix',
        'custom',
      ];
      const nextView = analysisViewOptions.includes(requested as AnalysisView)
        ? (requested as AnalysisView)
        : 'possession';
      onOpenAnalysis(nextView);
    },
    [onOpenAnalysis],
  );

  useEffect(() => {
    if (!globalThis.window.electronAPI?.on) {
      return;
    }

    const api = globalThis.window.electronAPI;

    // Note: 'general-shortcut-event'はuseGlobalHotkeysで処理されるため、ここでは登録しない
    api.on('menu-show-stats', handleMenuAnalysis);
    console.log('[ANALYSIS] menu-show-stats リスナー登録完了');

    return () => {
      try {
        api.off?.('menu-show-stats', handleMenuAnalysis);
        console.log('[ANALYSIS] リスナー解除完了');
      } catch (error) {
        console.debug('stats event cleanup error', error);
      }
    };
  }, [handleMenuAnalysis]); // useCallbackで安定した参照を依存配列に指定
};
