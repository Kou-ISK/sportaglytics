import { useEffect, useState } from 'react';
import type { AnalysisReportPayload } from '../../../report/types';
import {
  getAnalysisReportRequestIdFromHash,
  notifyAnalysisReportRenderReady,
  subscribeToAnalysisReportPayload,
} from '../gateways/analysisReportGateway';

interface UseAnalysisReportControllerResult {
  isLoading: boolean;
  payload: AnalysisReportPayload | null;
}

export const useAnalysisReportController =
  (): UseAnalysisReportControllerResult => {
    const [payload, setPayload] = useState<AnalysisReportPayload | null>(null);
    const [requestId, setRequestId] = useState<string>(
      getAnalysisReportRequestIdFromHash(),
    );

    useEffect(() => {
      return subscribeToAnalysisReportPayload((message) => {
        if (!message.payload) {
          return;
        }
        if (requestId && message.requestId && message.requestId !== requestId) {
          return;
        }
        if (message.requestId) {
          setRequestId(message.requestId);
        }
        setPayload(message.payload);
      });
    }, [requestId]);

    useEffect(() => {
      if (!payload || !requestId) {
        return;
      }
      let canceled = false;

      const run = async (): Promise<void> => {
        await notifyAnalysisReportRenderReady(requestId);
        if (canceled) {
          return;
        }
      };

      void run();
      return () => {
        canceled = true;
      };
    }, [payload, requestId]);

    return {
      isLoading: payload === null,
      payload,
    };
  };
