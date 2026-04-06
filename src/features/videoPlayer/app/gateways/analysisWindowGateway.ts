import type {
  AnalysisAiPlaylistPayload,
  AnalysisWindowSyncPayload,
} from '../../../../types/ipc/analysisWindow';
import type { TimelineData } from '../../../../types/TimelineData';

const getAnalysisApi = () => globalThis.window.electronAPI?.analysis;
const noop = (): void => undefined;

export const openAnalysisWindow = async (): Promise<boolean> => {
  const api = getAnalysisApi();
  if (!api?.openWindow) {
    return false;
  }

  try {
    await api.openWindow();
    return true;
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] openWindow failed', error);
    return false;
  }
};

export const closeAnalysisWindow = (): boolean => {
  const api = getAnalysisApi();
  if (!api?.closeWindow) {
    return false;
  }

  try {
    void api.closeWindow();
    return true;
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] closeWindow failed', error);
    return false;
  }
};

export const syncAnalysisWindow = (
  payload: AnalysisWindowSyncPayload,
): void => {
  const api = getAnalysisApi();
  if (!api?.syncToWindow) {
    return;
  }

  try {
    api.syncToWindow(payload);
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] syncToWindow failed', error);
  }
};

export const subscribeAnalysisWindowSync = (
  callback: (payload: AnalysisWindowSyncPayload) => void,
): (() => void) => {
  const api = getAnalysisApi();
  if (!api?.onSync || !api?.offSync) {
    return noop;
  }

  try {
    api.onSync(callback);
    return () => {
      try {
        api.offSync(callback);
      } catch (error: unknown) {
        console.debug('[AnalysisWindowGateway] offSync failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] onSync failed', error);
    return noop;
  }
};

export const sendAnalysisJumpToSegment = (segment: TimelineData): void => {
  const api = getAnalysisApi();
  if (!api?.sendJumpToSegment) {
    return;
  }

  try {
    api.sendJumpToSegment(segment);
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] sendJumpToSegment failed', error);
  }
};

export const sendAnalysisCreateAiPlaylist = (
  payload: AnalysisAiPlaylistPayload,
): void => {
  const api = getAnalysisApi();
  if (!api?.sendCreateAiPlaylist) {
    return;
  }

  try {
    api.sendCreateAiPlaylist(payload);
  } catch (error: unknown) {
    console.debug('[AnalysisWindowGateway] sendCreateAiPlaylist failed', error);
  }
};

export const subscribeAnalysisJumpToSegment = (
  callback: (segment: TimelineData) => void,
): (() => void) => {
  const api = getAnalysisApi();
  if (!api?.onJumpToSegment) {
    return noop;
  }

  try {
    return api.onJumpToSegment(callback);
  } catch (error: unknown) {
    console.debug(
      '[AnalysisWindowGateway] onJumpToSegment failed',
      error,
    );
    return noop;
  }
};

export const subscribeAnalysisCreateAiPlaylist = (
  callback: (payload: AnalysisAiPlaylistPayload) => void,
): (() => void) => {
  const api = getAnalysisApi();
  if (!api?.onCreateAiPlaylist) {
    return noop;
  }

  try {
    return api.onCreateAiPlaylist(callback);
  } catch (error: unknown) {
    console.debug(
      '[AnalysisWindowGateway] onCreateAiPlaylist failed',
      error,
    );
    return noop;
  }
};

export const subscribeAnalysisDashboardExternalOpen = (
  callback: (filePath: string) => void,
): (() => void) => {
  const api = getAnalysisApi();
  if (!api?.onDashboardExternalOpen) {
    return noop;
  }

  try {
    return api.onDashboardExternalOpen(callback);
  } catch (error: unknown) {
    console.debug(
      '[AnalysisWindowGateway] onDashboardExternalOpen failed',
      error,
    );
    return noop;
  }
};
