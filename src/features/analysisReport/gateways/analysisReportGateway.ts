import type { AnalysisReportPayload } from '../../../report/types';

export interface AnalysisReportPayloadMessage {
  requestId?: string;
  payload?: AnalysisReportPayload;
}

export const getAnalysisReportRequestIdFromHash = (): string => {
  const hash = globalThis.window.location.hash ?? '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query).get('requestId') ?? '';
};

export const subscribeToAnalysisReportPayload = (
  handler: (message: AnalysisReportPayloadMessage) => void,
): (() => void) => {
  const api = globalThis.window.electronAPI;
  if (!api?.onAnalysisReportPayload) {
    return () => {};
  }

  return api.onAnalysisReportPayload((message) => {
    const raw = message as AnalysisReportPayloadMessage | null | undefined;
    if (!raw) {
      return;
    }
    handler(raw);
  });
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

export const notifyAnalysisReportRenderReady = async (
  requestId: string,
): Promise<void> => {
  const api = globalThis.window.electronAPI;
  if (!requestId || !api?.notifyAnalysisReportRenderReady) {
    return;
  }

  await waitForStableRender();
  api.notifyAnalysisReportRenderReady(requestId);
};
