import { useEffect, useCallback } from 'react';
import type { StatsView } from '../../../features/videoPlayer/components/Analytics/StatsModal/StatsModal';

interface UseStatsMenuHandlersParams {
  onOpenStats: (view: StatsView) => void;
}

export const useStatsMenuHandlers = ({
  onOpenStats,
}: UseStatsMenuHandlersParams) => {
  // useCallbackで安定した関数参照を作成
  const handleMenuStats = useCallback(
    (_event: unknown, requested?: unknown) => {
      const statsViewOptions: StatsView[] = [
        'possession',
        'results',
        'types',
        'momentum',
        'matrix',
        'custom',
      ];
      const nextView = statsViewOptions.includes(requested as StatsView)
        ? (requested as StatsView)
        : 'possession';
      onOpenStats(nextView);
    },
    [onOpenStats],
  );

  useEffect(() => {
    if (!globalThis.window.electronAPI?.on) {
      return;
    }

    const api = globalThis.window.electronAPI;

    // Note: 'general-shortcut-event'はuseGlobalHotkeysで処理されるため、ここでは登録しない
    api.on('menu-show-stats', handleMenuStats);
    console.log('[STATS] menu-show-stats リスナー登録完了');

    return () => {
      try {
        api.off?.('menu-show-stats', handleMenuStats);
        console.log('[STATS] リスナー解除完了');
      } catch (error) {
        console.debug('stats event cleanup error', error);
      }
    };
  }, [handleMenuStats]); // useCallbackで安定した参照を依存配列に指定
};
