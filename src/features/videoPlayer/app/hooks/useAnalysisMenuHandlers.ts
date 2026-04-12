import { useCallback, useEffect, useRef } from 'react';
import type { AnalysisView } from '../../../../types/analysis/view';
import { subscribeAnalysisStatsMenu } from '../gateways/menuEventGateway';
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
    // Note: 'general-shortcut-event'はuseGlobalHotkeysで処理されるため、ここでは登録しない
    const unsubscribe = subscribeAnalysisStatsMenu(handleMenuAnalysis);

    return () => {
      safeMenuCleanup(unsubscribe);
    };
  }, [handleMenuAnalysis]);
};
