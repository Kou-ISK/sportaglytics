import { useCallback, useEffect, useRef } from 'react';
import type { AnalysisView } from '../../../../types/AnalysisView';
import {
  resolveRequestedAnalysisView,
  safeMenuCleanup,
} from './menuHandlerUtils';

interface UseAnalysisMenuHandlersParams {
  onOpenAnalysis: (view: AnalysisView) => void;
}

export const useAnalysisMenuHandlers = ({
  onOpenAnalysis,
}: UseAnalysisMenuHandlersParams): void => {
  const onOpenAnalysisRef = useRef(onOpenAnalysis);

  useEffect(() => {
    onOpenAnalysisRef.current = onOpenAnalysis;
  }, [onOpenAnalysis]);

  const handleMenuAnalysis = useCallback((requested?: unknown): void => {
    onOpenAnalysisRef.current(resolveRequestedAnalysisView(requested));
  }, []);

  useEffect(() => {
    if (!globalThis.window.electronAPI?.onMenuShowStats) {
      return;
    }

    const api = globalThis.window.electronAPI;

    // Note: 'general-shortcut-event'はuseGlobalHotkeysで処理されるため、ここでは登録しない
    const unsubscribe = api.onMenuShowStats(handleMenuAnalysis);

    return () => {
      safeMenuCleanup(unsubscribe);
    };
  }, [handleMenuAnalysis]);
};
