import { useEffect, useState } from 'react';
import type { AnalysisReportPayload } from '../../../../report/types';

const parseRequestIdFromHash = (): string => {
  const hash = globalThis.window.location.hash ?? '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query).get('requestId') ?? '';
};

const waitForStableRender = async (): Promise<void> => {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } })
    .fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {
      // Continue rendering even if font readiness fails.
    }
  }

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTimeout(resolve, 160);
      }),
    ),
  );
};

interface UseAnalysisReportPayloadResult {
  payload: AnalysisReportPayload | null;
}

export const useAnalysisReportPayload = (): UseAnalysisReportPayloadResult => {
  const [payload, setPayload] = useState<AnalysisReportPayload | null>(null);
  const [requestId, setRequestId] = useState<string>(parseRequestIdFromHash());

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onAnalysisReportPayload) return;

    const unsubscribe = api.onAnalysisReportPayload((message) => {
      const raw = message as
        | { requestId?: string; payload?: AnalysisReportPayload }
        | null
        | undefined;
      if (!raw?.payload) return;
      if (requestId && raw.requestId && raw.requestId !== requestId) return;
      if (raw.requestId) setRequestId(raw.requestId);
      setPayload(raw.payload);
    });
    return unsubscribe;
  }, [requestId]);

  useEffect(() => {
    if (!payload || !requestId) return;
    const api = globalThis.window.electronAPI;
    if (!api?.notifyAnalysisReportRenderReady) return;
    let canceled = false;

    const notifyReady = async () => {
      await waitForStableRender();
      if (canceled) return;
      api.notifyAnalysisReportRenderReady(requestId);
    };

    void notifyReady();
    return () => {
      canceled = true;
    };
  }, [payload, requestId]);

  return { payload };
};
